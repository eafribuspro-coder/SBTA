import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "") ?? "";

    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Non authentifié" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerProfile } = await supabaseAdmin
      .from("users")
      .select("role")
      .eq("id", caller.id)
      .maybeSingle();

    if (!callerProfile || callerProfile.role !== "admin") {
      return new Response(JSON.stringify({ error: "Accès refusé — Admin uniquement" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { user_id, new_role, company_id } = body;

    if (!user_id || !new_role) {
      return new Response(
        JSON.stringify({ error: "user_id et new_role sont requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (new_role === "client") {
      return new Response(
        JSON.stringify({ error: "Impossible d'assigner le rôle client via cet endpoint" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (new_role === "gestionnaire" && !company_id) {
      return new Response(
        JSON.stringify({ error: "Un gestionnaire doit être rattaché à une société" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: targetUser } = await supabaseAdmin
      .from("users")
      .select("id, role, first_name, last_name, email")
      .eq("id", user_id)
      .maybeSingle();

    if (!targetUser) {
      return new Response(
        JSON.stringify({ error: "Utilisateur introuvable" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (user_id === caller.id) {
      return new Response(
        JSON.stringify({ error: "Impossible de modifier son propre rôle" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const updateData: Record<string, unknown> = {
      role: new_role,
      company_id: new_role === "gestionnaire" ? company_id : null,
    };

    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update(updateData)
      .eq("id", user_id);

    if (updateError) throw updateError;

    await supabaseAdmin.from("activity_logs").insert({
      user_id: caller.id,
      target_id: user_id,
      target_type: "user",
      action: "role_changed",
      description: `Rôle modifié de ${targetUser.role} à ${new_role} pour ${targetUser.first_name} ${targetUser.last_name}`,
      old_values: { role: targetUser.role },
      new_values: { role: new_role, company_id: updateData.company_id },
    });

    return new Response(
      JSON.stringify({ success: true, user_id, old_role: targetUser.role, new_role }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
