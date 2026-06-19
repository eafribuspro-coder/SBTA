import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const OTP_TTL_MIN = 5;
const MAX_ATTEMPTS = 3;
const BLOCK_MIN = 10;

type Admin = ReturnType<typeof createClient>;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizePhone(p: string): string {
  return (p ?? "").replace(/\s+/g, "");
}

function isValidPhone(p: string): boolean {
  return /^0\d{9}$/.test(normalizePhone(p));
}

function isValidEmail(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((e ?? "").trim());
}

async function sha256(value: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function genCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function logAttempt(
  admin: Admin,
  phone: string,
  userId: string | null,
  event: string,
  success: boolean,
) {
  await admin.from("mobile_otp_attempts").insert({
    phone,
    user_id: userId,
    event,
    success,
  });
}

function toInternational(phone: string): string {
  let p = normalizePhone(phone).replace(/^\+/, "");
  if (p.startsWith("225")) return p;
  return `225${p}`;
}

async function sendOtpSms(phone: string, code: string): Promise<boolean> {
  const apiUrl = Deno.env.get("API_URL_EMISMS") ?? "https://app.emisms.com/sms/api";
  const apiKey = Deno.env.get("API_KEY_EMISMS");
  const senderId = Deno.env.get("SENDER_ID") ?? "SBTA";
  const message =
    `Votre code de verification SBTA est : ${code}. Il expire dans 5 minutes.`;

  if (!apiKey) {
    console.log(`[mobile-otp] API_KEY_EMISMS not configured. Code for ${phone} not sent.`);
    return false;
  }

  try {
    const url = new URL(apiUrl);
    url.searchParams.set("action", "send-sms");
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("to", toInternational(phone));
    url.searchParams.set("from", senderId);
    url.searchParams.set("sms", message);
    const resp = await fetch(url.toString(), { method: "GET" });
    const text = await resp.text();
    console.log(`[mobile-otp] EMISMS response: ${text}`);

    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }
    const respCode = String(parsed.code ?? parsed.status_code ?? parsed.status ?? "").toLowerCase();
    const respMsg = String(parsed.message ?? "").toLowerCase();
    const isSuccess =
      respCode === "ok" || respCode === "0" || respCode === "100" ||
      respCode === "1000" || respCode === "1" ||
      respMsg.includes("success") || respMsg.includes("sent") || respMsg.includes("queued");
    const isError =
      respMsg.includes("invalid") || respMsg.includes("error") ||
      respMsg.includes("fail") || respMsg.includes("insufficient") || respMsg.includes("denied");

    return resp.ok && (isSuccess || !isError);
  } catch (err) {
    console.error("[mobile-otp] SMS send failed:", err);
    return false;
  }
}

async function issueCode(admin: Admin, userId: string, phone: string) {
  const code = genCode();
  const codeHash = await sha256(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60_000).toISOString();

  await admin.from("mobile_otp_codes").insert({
    user_id: userId,
    phone,
    code_hash: codeHash,
    expires_at: expiresAt,
  });

  const sent = await sendOtpSms(phone, code);
  await logAttempt(admin, phone, userId, "sent", sent);
  return sent;
}

async function findUserByPhoneOrEmail(admin: Admin, phone: string, email: string) {
  const { data } = await admin
    .from("users")
    .select("id, email, phone, status")
    .or(`phone.eq.${phone},email.eq.${email}`)
    .limit(1)
    .maybeSingle();
  return data;
}

async function handleRegister(admin: Admin, body: Record<string, string>) {
  const fullName = (body.fullName ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const phone = normalizePhone(body.phone ?? "");

  if (!fullName) return json({ error: "Le nom complet est obligatoire." }, 400);
  if (!isValidPhone(phone)) {
    return json({ error: "Le numero de telephone est invalide." }, 400);
  }
  if (!isValidEmail(email)) return json({ error: "L'email est invalide." }, 400);
  if (password.length < 8) {
    return json({ error: "Le mot de passe doit contenir au moins 8 caracteres." }, 400);
  }

  const existing = await findUserByPhoneOrEmail(admin, phone, email);

  let userId: string;

  if (existing && existing.status !== "pending_otp") {
    return json(
      { error: "Ce numero ou cet email est deja utilise." },
      409,
    );
  }

  const parts = fullName.split(/\s+/);
  const firstName = parts[0] ?? "";
  const lastName = parts.slice(1).join(" ") || firstName;

  if (existing && existing.status === "pending_otp") {
    userId = existing.id;
    await admin.auth.admin.updateUserById(userId, {
      password,
      user_metadata: { full_name: fullName },
    });
    await admin
      .from("users")
      .update({
        email,
        full_name: fullName,
        first_name: firstName,
        last_name: lastName,
        phone,
      })
      .eq("id", userId);
  } else {
    const { data: created, error: createErr } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
    if (createErr || !created.user) {
      return json(
        { error: "Impossible de creer le compte. Cet email est peut-etre deja utilise." },
        400,
      );
    }
    userId = created.user.id;

    const { error: insertErr } = await admin.from("users").insert({
      id: userId,
      email,
      full_name: fullName,
      first_name: firstName,
      last_name: lastName,
      phone,
      role: "client",
      status: "pending_otp",
      is_active: false,
      is_self_registered: true,
    });
    if (insertErr) {
      await admin.auth.admin.deleteUser(userId);
      return json({ error: "Impossible de creer le profil." }, 500);
    }
  }

  const sent = await issueCode(admin, userId, phone);
  return json({ success: true, sent, phone });
}

async function handleResend(admin: Admin, body: Record<string, string>) {
  const phone = normalizePhone(body.phone ?? "");
  if (!isValidPhone(phone)) return json({ error: "Numero invalide." }, 400);

  const { data: user } = await admin
    .from("users")
    .select("id, status")
    .eq("phone", phone)
    .eq("status", "pending_otp")
    .limit(1)
    .maybeSingle();

  if (!user) {
    return json({ error: "Aucune inscription en attente pour ce numero." }, 404);
  }

  const { data: last } = await admin
    .from("mobile_otp_codes")
    .select("blocked_until")
    .eq("phone", phone)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (last?.blocked_until && new Date(last.blocked_until) > new Date()) {
    await logAttempt(admin, phone, user.id, "blocked", false);
    return json(
      { error: "Trop de tentatives. Reessayez dans quelques minutes." },
      429,
    );
  }

  const sent = await issueCode(admin, user.id, phone);
  return json({ success: true, sent });
}

async function handleVerify(admin: Admin, body: Record<string, string>) {
  const phone = normalizePhone(body.phone ?? "");
  const code = (body.code ?? "").trim();

  if (!isValidPhone(phone) || !/^\d{6}$/.test(code)) {
    return json({ error: "Code OTP invalide." }, 400);
  }

  const { data: otp } = await admin
    .from("mobile_otp_codes")
    .select("id, user_id, code_hash, expires_at, attempts, max_attempts, blocked_until, consumed_at")
    .eq("phone", phone)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!otp) {
    return json(
      { error: "Code expire. Veuillez demander un nouveau code." },
      400,
    );
  }

  const now = new Date();

  if (otp.blocked_until && new Date(otp.blocked_until) > now) {
    await logAttempt(admin, phone, otp.user_id, "blocked", false);
    return json(
      { error: "Trop de tentatives. Compte bloque 10 minutes." },
      429,
    );
  }

  if (new Date(otp.expires_at) < now) {
    await logAttempt(admin, phone, otp.user_id, "expired", false);
    return json(
      { error: "Code expire. Veuillez demander un nouveau code." },
      400,
    );
  }

  const hash = await sha256(code);
  if (hash === otp.code_hash) {
    await admin
      .from("mobile_otp_codes")
      .update({ consumed_at: now.toISOString() })
      .eq("id", otp.id);
    await admin
      .from("users")
      .update({ status: "active", is_active: true })
      .eq("id", otp.user_id);
    await logAttempt(admin, phone, otp.user_id, "verified", true);
    return json({ success: true });
  }

  const attempts = (otp.attempts ?? 0) + 1;
  const update: Record<string, unknown> = { attempts };
  let message = "Code OTP incorrect. Veuillez reessayer.";

  if (attempts >= (otp.max_attempts ?? MAX_ATTEMPTS)) {
    update.blocked_until = new Date(Date.now() + BLOCK_MIN * 60_000).toISOString();
    message = "Trop de tentatives. Compte bloque 10 minutes.";
  }

  await admin.from("mobile_otp_codes").update(update).eq("id", otp.id);
  await logAttempt(admin, phone, otp.user_id, "failed", false);
  return json({ error: message }, 400);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = (await req.json()) as Record<string, string>;
    const action = body.action;

    if (action === "register") return await handleRegister(admin, body);
    if (action === "resend") return await handleResend(admin, body);
    if (action === "verify") return await handleVerify(admin, body);

    return json({ error: "Action inconnue." }, 400);
  } catch (err) {
    console.error("[mobile-otp] Unhandled error:", err);
    return json({ error: "Erreur interne du serveur." }, 500);
  }
});
