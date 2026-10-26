import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Per-resource whitelist: table, writable fields, soft-delete support, audit columns.
type Resource = {
  table: string;
  fields: string[];
  softDelete: boolean;
  audit: boolean;
  orderBy: string;
};

const RESOURCES: Record<string, Resource> = {
  events: {
    table: "events",
    fields: ["title", "user_surname", "user_number", "social_network_link", "event_notes", "start_date", "end_date", "payment_status", "payment_amount", "event_name", "type"],
    softDelete: true, audit: true, orderBy: "start_date",
  },
  customers: {
    table: "customers",
    fields: ["title", "user_surname", "user_number", "social_network_link", "event_notes", "payment_status", "payment_amount", "start_date", "end_date"],
    softDelete: true, audit: true, orderBy: "created_at",
  },
  tasks: {
    table: "tasks",
    fields: ["title", "description", "status", "deadline_at", "reminder_at", "archived"],
    softDelete: false, audit: true, orderBy: "created_at",
  },
  notes: {
    table: "notes",
    fields: ["title", "content", "color"],
    softDelete: false, audit: false, orderBy: "created_at",
  },
  reminders: {
    table: "custom_reminders",
    fields: ["title", "message", "remind_at"],
    softDelete: true, audit: false, orderBy: "remind_at",
  },
};

const TASK_STATUSES = ["todo", "inprogress", "done"];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function sha256(value: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function pick(input: Record<string, unknown>, fields: string[]) {
  const out: Record<string, unknown> = {};
  for (const f of fields) if (f in input) out[f] = input[f];
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const auth = req.headers.get("x-api-key") || (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!auth || !auth.startsWith("sbk_")) return json({ error: "Missing or invalid API key. Send it as 'Authorization: Bearer sbk_...'" }, 401);

  const { data: key } = await supabase
    .from("agent_api_keys")
    .select("id, user_id, name, revoked_at")
    .eq("key_hash", await sha256(auth))
    .maybeSingle();
  if (!key || key.revoked_at) return json({ error: "API key not recognised or revoked" }, 401);

  const userId = key.user_id as string;
  const agentName = key.name as string;
  await supabase.from("agent_api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", key.id);

  if (req.method === "GET") {
    return json({ ok: true, account: userId, agent: agentName, resources: Object.keys(RESOURCES), actions: ["list", "get", "create", "update", "delete"] });
  }
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Body must be JSON" }, 400); }
  const { action, resource, id, data, filters } = body ?? {};
  const res = RESOURCES[resource];
  if (!res) return json({ error: `Unknown resource. Use one of: ${Object.keys(RESOURCES).join(", ")}` }, 400);
  if (!["list", "get", "create", "update", "delete"].includes(action)) return json({ error: "action must be list, get, create, update or delete" }, 400);
  if (["get", "update", "delete"].includes(action) && (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id))) {
    return json({ error: "A valid record id is required" }, 400);
  }

  const log = (resourceId: string | null, details: unknown) =>
    supabase.from("agent_activity_log").insert({
      user_id: userId, key_id: key.id, agent_name: agentName, action, resource_type: resource, resource_id: resourceId, details,
    });

  const scoped = () => {
    let q: any = supabase.from(res.table);
    return q;
  };

  try {
    if (action === "list") {
      const limit = Math.min(Math.max(Number(filters?.limit) || 50, 1), 200);
      let q = scoped().select("*").eq("user_id", userId).order(res.orderBy, { ascending: false }).limit(limit);
      if (res.softDelete) q = q.is("deleted_at", null);
      if (typeof filters?.search === "string" && filters.search.trim()) {
        q = q.ilike("title", `%${filters.search.trim().replace(/[\\%]/g, (m: string) => "\\" + m)}%`);
      }
      if (filters?.from) q = q.gte(res.orderBy, filters.from);
      if (filters?.to) q = q.lte(res.orderBy, filters.to);
      if (resource === "tasks" && filters?.status) q = q.eq("status", filters.status);
      const { data: rows, error } = await q;
      if (error) throw error;
      return json({ ok: true, count: rows.length, items: rows });
    }

    if (action === "get") {
      let q = scoped().select("*").eq("user_id", userId).eq("id", id);
      if (res.softDelete) q = q.is("deleted_at", null);
      const { data: row, error } = await q.maybeSingle();
      if (error) throw error;
      if (!row) return json({ error: "Not found" }, 404);
      return json({ ok: true, item: row });
    }

    if (action === "delete") {
      const q = res.softDelete
        ? scoped().update({ deleted_at: new Date().toISOString() })
        : scoped().delete();
      const { data: rows, error } = await q.eq("user_id", userId).eq("id", id).select("id, title");
      if (error) throw error;
      if (!rows?.length) return json({ error: "Not found" }, 404);
      await log(id, { title: rows[0].title });
      return json({ ok: true, deleted: id });
    }

    const payload = pick((data ?? {}) as Record<string, unknown>, res.fields);
    if (resource === "tasks" && payload.status && !TASK_STATUSES.includes(String(payload.status))) {
      return json({ error: `status must be one of ${TASK_STATUSES.join(", ")}` }, 400);
    }
    const now = new Date().toISOString();
    const label = `${agentName} (AI agent)`;

    if (action === "create") {
      if (!payload.title || typeof payload.title !== "string") return json({ error: "data.title is required" }, 400);
      if (resource === "events" && (!payload.start_date || !payload.end_date)) return json({ error: "events need start_date and end_date (ISO 8601)" }, 400);
      if (resource === "reminders" && !payload.remind_at) return json({ error: "reminders need remind_at (ISO 8601)" }, 400);
      const row: Record<string, unknown> = { ...payload, user_id: userId };
      if (resource === "tasks" && !row.status) row.status = "todo";
      if (res.audit) Object.assign(row, { created_by_type: "admin", created_by_name: label, created_by_ai: true });
      if (resource === "reminders") Object.assign(row, { created_by_type: "admin", created_by_name: label });
      const { data: created, error } = await scoped().insert(row).select("*").single();
      if (error) throw error;
      await log(created.id, { title: created.title, fields: Object.keys(payload) });
      return json({ ok: true, item: created });
    }

    // update — only provided fields change, everything else is preserved
    if (!Object.keys(payload).length) return json({ error: `Nothing to update. Allowed fields: ${res.fields.join(", ")}` }, 400);
    const patch: Record<string, unknown> = { ...payload };
    if (res.audit) Object.assign(patch, { last_edited_by_type: "admin", last_edited_by_name: label, last_edited_at: now, last_edited_by_ai: true });
    let q = scoped().update(patch).eq("user_id", userId).eq("id", id);
    if (res.softDelete) q = q.is("deleted_at", null);
    const { data: rows, error } = await q.select("*");
    if (error) throw error;
    if (!rows?.length) return json({ error: "Not found" }, 404);
    await log(id, { title: rows[0].title, fields: Object.keys(payload) });
    return json({ ok: true, item: rows[0] });
  } catch (e) {
    console.error("agent-api error", e);
    return json({ error: (e as Error)?.message || "Request failed" }, 500);
  }
});
