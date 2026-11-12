import { adminCors, checkCredentials, issueAdminToken } from "../_shared/adminAuth.ts";
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...adminCors, "Content-Type": "application/json" } });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: adminCors });
  try {
    const { username, password } = await req.json();
    if (typeof username !== "string" || typeof password !== "string" || !checkCredentials(username, password)) {
      await new Promise((r) => setTimeout(r, 600));
      return json({ error: "Invalid credentials" }, 401);
    }
    return json(await issueAdminToken(username));
  } catch (e) {
    console.error("admin-login", e);
    return json({ error: "Login unavailable" }, 500);
  }
});
