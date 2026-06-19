import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PASSWORD = "Password123!";

// 13 comptes qui résistent à updateUserById — recréation complète avec mêmes UUIDs
const BROKEN_ACCOUNTS = [
  { id: "615397c6-2d60-4bda-b4b0-2efb457a65ab", email: "chauffeur1@sbta.ci",   role: "chauffeur",     full_name: "Chauffeur 1" },
  { id: "50510b79-6866-44b0-8478-1cc04a32a982", email: "chauffeur2@sbta.ci",   role: "chauffeur",     full_name: "Chauffeur 2" },
  { id: "7be5e0bf-eeb5-4362-a774-684b26f93ed6", email: "chauffeur3@sbta.ci",   role: "chauffeur",     full_name: "Chauffeur 3" },
  { id: "a3add3f0-5797-450f-bf0f-d1b9f0d781e7", email: "chefgarage1@sbta.ci",  role: "chef_garage",   full_name: "Chef Garage 1" },
  { id: "2d2f2ddc-68e7-444d-8e3f-303fe2b7aa65", email: "chefgare1@sbta.ci",    role: "chef_gare",     full_name: "Koné CHEF GARE Abidjan" },
  { id: "6e1f72a0-c1ed-4d58-aae7-95fb23a902a4", email: "comptable@sbta.ci",    role: "comptable",     full_name: "Comptable SBTA" },
  { id: "fd793988-b523-4998-b9a2-7888d9328b78", email: "daf@sbta.ci",          role: "daf",           full_name: "DAF SBTA" },
  { id: "efa710e0-d523-4810-a7e1-5a8b2d517fe5", email: "gest.express@sbta.ci", role: "gestionnaire",  full_name: "Gestionnaire Express" },
  { id: "39550267-e64a-43a3-8036-93dc77ca3e5e", email: "gest.premium@sbta.ci", role: "gestionnaire",  full_name: "Gestionnaire Premium" },
  { id: "b941e417-7400-46b9-8e82-8e3d8200c57e", email: "guichet1@sbta.ci",     role: "guichetier",    full_name: "Guichetier 1" },
  { id: "a3c08153-6711-48f3-b34a-0797ad1af345", email: "meca1@sbta.ci",        role: "mecanicien",    full_name: "Mécanicien 1" },
  { id: "d442237b-c0ad-4113-9c7c-9dd6dbd6f604", email: "planif1@sbta.ci",      role: "planificateur", full_name: "Planificateur 1" },
  { id: "5ea1f6e1-9dfa-4d8a-8fbe-91bdf0c12d70", email: "pompiste1@sbta.ci",    role: "pompiste",      full_name: "Pompiste 1" },
];

// 12 comptes qui fonctionnent déjà — juste update password
const WORKING_IDS = [
  "adb65952-11e5-48c9-be5a-7aaec9024876",
  "3c57e8c8-8740-4f69-ae44-89caaf14d2b7",
  "a341eae3-4f47-407c-a9b6-fe1fbda55d31",
  "2f748733-b524-4bae-90ba-bbcb618d90cf",
  "10a1e9b6-d1cb-4a24-9aa2-3778f8f2c9e7",
  "1019298d-f43e-4aed-95be-e376e272f043",
  "769d5777-7c1d-4beb-b1ae-bb27a0c01429",
  "fdcceb67-2e55-4f02-ba4a-c27f54126a65",
  "9f9790fe-4a8d-47ec-bd7d-d0a0120bb62f",
  "1e111acf-ecfd-4f10-9a79-8e2328ad6baf",
  "72c23f0d-5a7a-4ac9-8981-9fc22225f92a",
  "3172baa4-c5dc-4ee2-aa2a-92a175a299a0",
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const results: { email: string; action: string; ok: boolean; error?: string }[] = [];

    // Step 1: Update password for working accounts
    for (const uid of WORKING_IDS) {
      const { error } = await admin.auth.admin.updateUserById(uid, { password: PASSWORD });
      results.push({ email: uid, action: "update", ok: !error, error: error?.message });
    }

    // Step 2: Delete and recreate broken accounts with same UUID
    for (const acc of BROKEN_ACCOUNTS) {
      try {
        // Delete from auth (cascades to auth.identities)
        const { error: delErr } = await admin.auth.admin.deleteUser(acc.id);
        if (delErr) {
          results.push({ email: acc.email, action: "delete", ok: false, error: delErr.message });
          continue;
        }

        // Recreate with same UUID via createUser
        const { data: created, error: createErr } = await admin.auth.admin.createUser({
          email: acc.email,
          password: PASSWORD,
          email_confirm: true,
          user_metadata: { role: acc.role, full_name: acc.full_name, email_verified: true },
          app_metadata:  { role: acc.role, provider: "email", providers: ["email"] },
        });

        if (createErr || !created?.user) {
          results.push({ email: acc.email, action: "create", ok: false, error: createErr?.message });
          continue;
        }

        const newId = created.user.id;

        // If GoTrue assigned a different UUID, update public.users to point to new ID
        if (newId !== acc.id) {
          // Update public.users id
          const { error: updateErr } = await admin
            .from("users")
            .update({ id: newId })
            .eq("id", acc.id);

          if (updateErr) {
            results.push({ email: acc.email, action: "remap_public_user", ok: false, error: updateErr.message });
            continue;
          }
        }

        results.push({ email: acc.email, action: "recreate", ok: true,
          error: newId !== acc.id ? `new_id=${newId}` : undefined });
      } catch (e: any) {
        results.push({ email: acc.email, action: "recreate", ok: false, error: e.message });
      }
    }

    const failed    = results.filter(r => !r.ok);
    const succeeded = results.filter(r => r.ok);

    return new Response(
      JSON.stringify({
        total:     results.length,
        succeeded: succeeded.length,
        failed:    failed.length,
        failures:  failed,
        results,
        password:  PASSWORD,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
