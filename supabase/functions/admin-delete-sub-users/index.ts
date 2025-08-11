// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(status: number, body: any) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

export const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return jsonResponse(500, { error: "Missing Supabase env vars" });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { ownerEmail, emails } = await req.json();

    if (!ownerEmail || !Array.isArray(emails) || emails.length === 0) {
      return jsonResponse(400, { error: "ownerEmail and emails[] are required" });
    }

    const norm = (s: string) => (s || "").trim().toLowerCase();
    const ownerEmailNorm = norm(ownerEmail);
    const emailsNorm = emails.map(norm);

    // Get board owner user id via Auth Admin API
    const { data: ownerUser, error: ownerErr } = await supabase.auth.admin.getUserByEmail(ownerEmailNorm);
    if (ownerErr || !ownerUser?.user) {
      return jsonResponse(404, { error: "Owner user not found", detail: ownerErr?.message });
    }
    const ownerId = ownerUser.user.id;

    // Get all public boards for this owner
    const { data: boards, error: boardsErr } = await supabase
      .from("public_boards")
      .select("id")
      .eq("user_id", ownerId);
    if (boardsErr) {
      return jsonResponse(500, { error: "Failed fetching boards", detail: boardsErr.message });
    }
    const boardIds = (boards || []).map((b: any) => b.id);

    // Delete sub_users rows
    const { error: delSubsErr } = await supabase
      .from("sub_users")
      .delete()
      .eq("board_owner_id", ownerId)
      .in("email", emailsNorm);
    if (delSubsErr) {
      return jsonResponse(500, { error: "Failed deleting sub users", detail: delSubsErr.message });
    }

    // Also delete any existing access tokens for these emails on these boards
    if (boardIds.length > 0) {
      const { error: delAccessErr } = await supabase
        .from("public_board_access")
        .delete()
        .in("board_id", boardIds)
        .in("external_user_email", emailsNorm);
      if (delAccessErr) {
        // Non-fatal, but report
        console.warn("Failed deleting public_board_access records", delAccessErr);
      }
    }

    return jsonResponse(200, { success: true, ownerId, emails: emailsNorm });
  } catch (e) {
    console.error("admin-delete-sub-users error", e);
    return jsonResponse(500, { error: "Unhandled error", detail: String(e) });
  }
};

Deno.serve(handler);
