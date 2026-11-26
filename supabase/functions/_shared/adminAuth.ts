// Server-issued admin session tokens: base64url(payload).hmac, signed with ADMIN_TOKEN_SECRET.
const enc = new TextEncoder();
const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function hmac(data: string): Promise<string> {
  const secret = Deno.env.get("ADMIN_TOKEN_SECRET");
  if (!secret) throw new Error("ADMIN_TOKEN_SECRET missing");
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64u(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data))));
}
function safeEq(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
export const SESSION_MS = 4 * 60 * 60 * 1000;
export async function issueAdminToken(username: string): Promise<{ token: string; exp: number }> {
  const exp = Date.now() + SESSION_MS;
  const p = b64u(enc.encode(JSON.stringify({ u: username, exp })));
  return { token: `${p}.${await hmac(p)}`, exp };
}
export async function verifyAdminToken(req: Request): Promise<boolean> {
  try {
    const t = req.headers.get("x-admin-token") || "";
    const [p, s] = t.split(".");
    if (!p || !s || !safeEq(s, await hmac(p))) return false;
    const { exp } = JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof exp === "number" && exp > Date.now();
  } catch { return false; }
}
export function checkCredentials(u: string, pw: string): boolean {
  const eu = Deno.env.get("ADMIN_USERNAME"), ep = Deno.env.get("ADMIN_PASSWORD");
  if (!eu || !ep) return false;
  return safeEq(u, eu) && safeEq(pw, ep);
}
export const adminCors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-token",
};
export const unauthorized = () => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...adminCors, "Content-Type": "application/json" } });
