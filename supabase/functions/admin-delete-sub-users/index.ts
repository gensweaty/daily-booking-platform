import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase environment variables" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { ownerEmail, emails } = await req.json();

    if (!ownerEmail || !Array.isArray(emails) || emails.length === 0) {
      return new Response(
        JSON.stringify({ error: "ownerEmail and emails[] are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalize = (s: string) => (s || "").trim().toLowerCase();
    const ownerEmailNorm = normalize(ownerEmail);
    const emailsNorm = emails.map(normalize);

    // Get board owner user ID via Auth Admin API
    const { data: ownerUsers, error: ownerErr } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    });
    
    if (ownerErr) {
      console.error("Error fetching owner user:", ownerErr);
      return new Response(
        JSON.stringify({ error: "Failed to fetch owner user", detail: ownerErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const ownerUser = ownerUsers.users.find(u => u.email?.toLowerCase() === ownerEmailNorm);
    if (!ownerUser) {
      return new Response(
        JSON.stringify({ error: "Owner user not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const ownerId = ownerUser.id;

    // Get all public boards for this owner
    const { data: boards, error: boardsErr } = await supabase
      .from("public_boards")
      .select("id")
      .eq("user_id", ownerId);
      
    if (boardsErr) {
      console.error("Error fetching boards:", boardsErr);
      return new Response(
        JSON.stringify({ error: "Failed to fetch boards", detail: boardsErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const boardIds = (boards || []).map((b) => b.id);

    // Delete sub_users rows
    const { error: delSubsErr } = await supabase
      .from("sub_users")
      .delete()
      .eq("board_owner_id", ownerId)
      .in("email", emailsNorm);
      
    if (delSubsErr) {
      console.error("Error deleting sub-users:", delSubsErr);
      return new Response(
        JSON.stringify({ error: "Failed to delete sub-users", detail: delSubsErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Delete access tokens for these emails on these boards
    if (boardIds.length > 0) {
      const { error: delAccessErr } = await supabase
        .from("public_board_access")
        .delete()
        .in("board_id", boardIds)
        .in("external_user_email", emailsNorm);
        
      if (delAccessErr) {
        console.warn("Failed to delete public_board_access records:", delAccessErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, ownerId, emails: emailsNorm }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("admin-delete-sub-users error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
