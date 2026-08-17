import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Exchanges a single-use render token for a short-lived Supabase session so the
 * headless renderer can open the owner's dashboard read-only and screenshot it.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const { token } = await req.json().catch(() => ({}));
    if (!token || typeof token !== "string" || token.length < 20) {
      return json({ error: "invalid_token" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const tokenHash = await sha256Hex(token);
    const { data: row } = await admin
      .from("render_tokens")
      .select("*")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (!row) return json({ error: "token_not_found" }, 401);
    if (row.used_at) return json({ error: "token_already_used" }, 401);
    if (new Date(row.expires_at).getTime() < Date.now()) return json({ error: "token_expired" }, 401);

    // Single use — burn it immediately
    await admin.from("render_tokens").update({ used_at: new Date().toISOString() }).eq("id", row.id);

    const { data: userRes, error: userErr } = await admin.auth.admin.getUserById(row.user_id);
    if (userErr || !userRes?.user?.email) return json({ error: "user_not_found" }, 404);

    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: userRes.user.email,
    });
    if (linkErr || !link?.properties?.hashed_token) {
      return json({ error: linkErr?.message || "link_failed" }, 500);
    }

    const { data: verified, error: verifyErr } = await admin.auth.verifyOtp({
      type: "magiclink",
      token_hash: link.properties.hashed_token,
    });
    if (verifyErr || !verified?.session) {
      return json({ error: verifyErr?.message || "session_failed" }, 500);
    }

    return json({
      access_token: verified.session.access_token,
      refresh_token: verified.session.refresh_token,
      page_hint: row.page_hint,
      popup_target: row.popup_target,
      screenshot_request_id: row.screenshot_request_id,
    });
  } catch (e) {
    console.error("render-session error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
