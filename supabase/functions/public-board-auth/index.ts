import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Server-side team-board sign-in: passwords are checked and hashed here, tokens are random and issued here.
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const db = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

const b64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function derive(password: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), { name: "PBKDF2" }, false, ["deriveBits"]);
  return crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, key, 256);
}
async function makeHash(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { password_hash: b64(await derive(password, salt)), password_salt: b64(salt.buffer) };
}
function safeEq(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
async function verify(password: string, salt: string, hash: string) {
  try { return safeEq(b64(await derive(password, unb64(salt))), hash); } catch { return false; }
}
const newToken = (boardId: string) => {
  const r = crypto.getRandomValues(new Uint8Array(24));
  return `${boardId}-${Date.now()}-${Array.from(r, (x) => x.toString(16).padStart(2, "0")).join("")}`;
};
const str = (v: unknown, max = 320) => (typeof v === "string" && v.trim() && v.length <= max ? v.trim() : null);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const slug = str(body.slug, 200);
    const email = str(body.email)?.toLowerCase() ?? null;
    if (!slug || !email || !EMAIL.test(email)) return json({ error: "invalid_request" }, 400);
    const sb = db();
    const { data: board } = await sb.from("public_boards").select("id,user_id,magic_word,is_active").eq("slug", slug).eq("is_active", true).maybeSingle();
    if (!board) return json({ error: "board_not_found" }, 404);
    const { data: sub } = await sb.from("sub_users").select("id,fullname,password_hash,password_salt")
      .eq("board_owner_id", board.user_id).ilike("email", email).maybeSingle();
    const now = new Date().toISOString();

    if (action === "login") {
      const password = typeof body.password === "string" ? body.password : "";
      if (!sub) return json({ error: "not_registered" }, 401);
      if (!sub.password_hash || !sub.password_salt) return json({ error: "password_not_set" }, 401);
      if (!password || !(await verify(password, sub.password_salt, sub.password_hash))) {
        await new Promise((r) => setTimeout(r, 400));
        return json({ error: "invalid_credentials" }, 401);
      }
      await sb.from("sub_users").update({ last_login_at: now, updated_at: now }).eq("id", sub.id);
      const fullName = sub.fullname || email;
      const token = newToken(board.id);
      const { error } = await sb.from("public_board_access").insert({ board_id: board.id, access_token: token, external_user_name: fullName, external_user_email: email });
      if (error) throw error;
      return json({ token, fullName, subUserId: sub.id, boardOwnerId: board.user_id });
    }

    if (action === "register") {
      const password = typeof body.password === "string" ? body.password : "";
      const fullNameIn = str(body.fullName, 200);
      if (!fullNameIn || password.length < 6 || password.length > 200) return json({ error: "invalid_request" }, 400);
      if (typeof body.magicWord !== "string" || body.magicWord.trim() !== board.magic_word) return json({ error: "invalid_magic_word" }, 403);
      const hashed = await makeHash(password);
      let subUserId: string;
      if (sub) {
        const { error } = await sb.from("sub_users").update({ fullname: fullNameIn, ...hashed, last_login_at: now, updated_at: now }).eq("id", sub.id);
        if (error) throw error;
        subUserId = sub.id;
      } else {
        const { count } = await sb.from("sub_users").select("id", { count: "exact", head: true }).eq("board_owner_id", board.user_id);
        if ((count ?? 0) >= 10) return json({ error: "max_sub_users" }, 409);
        let finalName = fullNameIn;
        const { data: clash } = await sb.from("sub_users").select("id").eq("board_owner_id", board.user_id).eq("fullname", finalName).maybeSingle();
        if (clash) finalName = `${finalName}_${email.split("@")[0]}`;
        const { data, error } = await sb.from("sub_users").insert({ board_owner_id: board.user_id, fullname: finalName, email, ...hashed, last_login_at: now }).select("id").single();
        if (error) throw error;
        subUserId = data.id;
      }
      const token = newToken(board.id);
      const { error } = await sb.from("public_board_access").insert({ board_id: board.id, access_token: token, external_user_name: fullNameIn, external_user_email: email });
      if (error) throw error;
      return json({ token, fullName: fullNameIn, subUserId, boardOwnerId: board.user_id });
    }

    if (action === "change_password") {
      const token = str(body.token, 300);
      const password = typeof body.newPassword === "string" ? body.newPassword : "";
      if (!token || password.length < 6 || password.length > 200 || !sub) return json({ error: "invalid_request" }, 400);
      const { data: access } = await sb.from("public_board_access").select("id,external_user_email").eq("board_id", board.id).eq("access_token", token).maybeSingle();
      if (!access || (access.external_user_email || "").toLowerCase() !== email) return json({ error: "unauthorized" }, 401);
      const { error } = await sb.from("sub_users").update({ ...(await makeHash(password)), updated_at: now }).eq("id", sub.id);
      if (error) throw error;
      return json({ ok: true });
    }
    return json({ error: "invalid_request" }, 400);
  } catch (e) {
    console.error("public-board-auth", e);
    return json({ error: "internal_error" }, 500);
  }
});
