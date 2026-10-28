import { useCallback, useEffect, useState } from "react";
import { Bot, Copy, KeyRound, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/components/ui/use-toast";

const ENDPOINT = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID || "mrueqpffzauvdxmuwhfa"}.supabase.co/functions/v1/agent-api`;

const copy = {
  en: { button: "AI agents & API keys", title: "AI agent access", keys: "Keys", docs: "Instructions", history: "History", name: "Agent name, e.g. Claude Desktop", create: "Create key", once: "Copy this key now. It won't be shown again.", revoke: "Turn off", revoked: "Turned off", lastUsed: "Last used", never: "Never used", none: "No keys yet.", noHistory: "No agent actions yet.", copied: "Copied", copyDocs: "Copy instructions for your agent", intro: "Give an AI agent a key and these instructions. It can only work on your account, and every change is saved here with the agent's name." },
  es: { button: "Agentes de IA y claves API", title: "Acceso de agentes de IA", keys: "Claves", docs: "Instrucciones", history: "Historial", name: "Nombre del agente, p. ej. Claude Desktop", create: "Crear clave", once: "Copia esta clave ahora. No se volverá a mostrar.", revoke: "Desactivar", revoked: "Desactivada", lastUsed: "Último uso", never: "Sin uso", none: "Aún no hay claves.", noHistory: "Aún no hay acciones de agentes.", copied: "Copiado", copyDocs: "Copiar instrucciones para tu agente", intro: "Da a un agente de IA una clave y estas instrucciones. Solo puede trabajar en tu cuenta y cada cambio se guarda aquí con el nombre del agente." },
  ka: { button: "AI აგენტები და API გასაღებები", title: "AI აგენტის წვდომა", keys: "გასაღებები", docs: "ინსტრუქცია", history: "ისტორია", name: "აგენტის სახელი, მაგ. Claude Desktop", create: "გასაღების შექმნა", once: "დააკოპირეთ ეს გასაღები ახლავე. ის აღარ გამოჩნდება.", revoke: "გამორთვა", revoked: "გამორთულია", lastUsed: "ბოლო გამოყენება", never: "არ გამოყენებულა", none: "გასაღებები ჯერ არ არის.", noHistory: "აგენტის ქმედებები ჯერ არ არის.", copied: "დაკოპირდა", copyDocs: "ინსტრუქციის კოპირება აგენტისთვის", intro: "მიეცით AI აგენტს გასაღები და ეს ინსტრუქცია. ის მხოლოდ თქვენს ანგარიშზე იმუშავებს და ყველა ცვლილება აქ შეინახება აგენტის სახელით." },
};

export const agentDocs = (endpoint: string) => `# SmartBookly Agent API — README for AI agents

You are an assistant working on ONE SmartBookly account: the account that owns your API key.
SmartBookly is a booking platform: calendar bookings, a customer list (CRM), tasks, notes and reminders.
Everything you change is saved in the owner's History under your key's name.

## 0. Golden rules
1. Never say something was created, changed or deleted unless the response contains "ok": true. Quote what was saved.
2. Before update or delete, find the exact record with "list" (use "search"). If several match, ask the user which one. Never guess an id.
3. "update" changes ONLY the fields you send. Never resend fields you did not mean to change.
4. Always use full ISO 8601 times WITH timezone, e.g. 2026-11-03T14:00:00+04:00. Ask the user's timezone if unsure.
5. Ask before deleting. Ask when a date, time or name is missing — don't invent it.
6. On an error, tell the user the error text. Don't retry the same request in a loop.
7. You cannot see other accounts. You cannot read or change things not listed here (see section 9).

## 1. Connecting
Endpoint: ${endpoint}
Header:   Authorization: Bearer YOUR_KEY   (or  x-api-key: YOUR_KEY)
Content-Type: application/json

GET  ${endpoint}  -> checks the key and returns your agent name, resources and fields. Call it first.
POST ${endpoint}  -> do something. Body:
{"action":"list|get|create|update|delete","resource":"events|customers|tasks|notes|reminders","id":"<uuid, for get/update/delete>","data":{...for create/update},"filters":{...for list}}

## 2. Actions (same for every resource)
- list   — find records. Newest first. Response: {"ok":true,"items":[...],"count":n,"total":N,"offset":o,"next_offset":o2|null}
           filters: limit (1-200, default 50), offset (default 0), search (text in title, case-insensitive), from / to (ISO dates), status (tasks only).
           If next_offset is not null, call again with offset = next_offset to get more.
- get    — one record by id. Response: {"ok":true,"item":{...}}
- create — add a record. Response: {"ok":true,"item":{...}} (contains the new id)
- update — change some fields of a record by id.
- delete — remove a record by id. Response: {"ok":true,"deleted":"<id>"}
Every record also has "id" and "created_at" (read-only).

## 3. Calendar bookings — resource "events"
What a human does in the Calendar tab: add a booking, move it, change payment, delete it.
Fields:
- title (required, 1-255) — customer's full name / booking name
- user_surname — extra name text
- user_number — phone number, e.g. +995555123456
- social_network_link — email or social profile link
- event_notes — notes/comments
- event_name — name of the service/event (e.g. "Haircut", "Interview")
- start_date, end_date (required on create; end must be after start)
- payment_status — "not_paid", "partly_paid" or "fully_paid"
- payment_amount — number ≥ 0 (or null)
- type — booking type text (usually leave empty)
Date filters (from/to) use start_date.
Examples:
- See bookings next week: {"action":"list","resource":"events","filters":{"from":"2026-11-02T00:00:00+04:00","to":"2026-11-08T23:59:59+04:00"}}
- Book: {"action":"create","resource":"events","data":{"title":"Anna Smith","user_number":"+995555123456","event_name":"Haircut","start_date":"2026-11-03T14:00:00+04:00","end_date":"2026-11-03T15:00:00+04:00","payment_status":"not_paid"}}
- Reschedule (send both times): {"action":"update","resource":"events","id":"<id>","data":{"start_date":"2026-11-04T10:00:00+04:00","end_date":"2026-11-04T11:00:00+04:00"}}
- Mark paid: {"action":"update","resource":"events","id":"<id>","data":{"payment_status":"fully_paid","payment_amount":50}}
- Cancel: find it with list, confirm with the user, then {"action":"delete","resource":"events","id":"<id>"}
Before booking, list events for that day to check the time is free; tell the user if it overlaps.

## 4. Customers (CRM) — resource "customers"
What a human does in the CRM tab: add, edit, look up and remove customers.
Fields: title (required — customer's full name), user_surname, user_number (phone), social_network_link (email/social), event_notes (comments), payment_status, payment_amount, start_date, end_date (optional).
Date filters use created_at.
Examples:
- Find: {"action":"list","resource":"customers","filters":{"search":"Anna"}}
- Add: {"action":"create","resource":"customers","data":{"title":"Giorgi Beridze","user_number":"+995599000111","social_network_link":"giorgi@example.com","event_notes":"VIP"}}
- Edit phone: {"action":"update","resource":"customers","id":"<id>","data":{"user_number":"+995599222333"}}
Search before adding to avoid duplicates; if the person already exists, update instead.

## 5. Tasks — resource "tasks"
What a human does on the Tasks board: add a task, move it between columns, set deadline/reminder, archive.
Fields:
- title (required), description (text/HTML)
- status — "todo" (To do), "inprogress" (In progress), "done" (Done)
- deadline_at — due time; reminder_at — when to remind
- archived — true / false
Extra list filter: status.
Examples:
- Add: {"action":"create","resource":"tasks","data":{"title":"Call supplier","status":"todo","deadline_at":"2026-11-05T18:00:00+04:00"}}
- Move to done: {"action":"update","resource":"tasks","id":"<id>","data":{"status":"done"}}
- Open tasks: {"action":"list","resource":"tasks","filters":{"status":"todo"}}
- Archive: {"action":"update","resource":"tasks","id":"<id>","data":{"archived":true}}

## 6. Notes — resource "notes"
Fields: title (required), content (text), color (e.g. "#FFE58F").
Example: {"action":"create","resource":"notes","data":{"title":"Supplier prices","content":"Shampoo 12 GEL"}}

## 7. Reminders — resource "reminders"
What a human does with "remind me…": SmartBookly alerts the owner at that time (in the app, and by email/Telegram if the owner turned those on).
Fields: title (required), message (text), remind_at (required, must be in the future).
Date filters use remind_at.
Example: "remind me 1 hour before my 10:00 interview on 3 Nov" -> {"action":"create","resource":"reminders","data":{"title":"Interview","message":"Interview at 10:00","remind_at":"2026-11-03T09:00:00+04:00"}}
To change the time: update remind_at. To cancel: delete.

## 8. Common jobs (step by step)
- "What do I have tomorrow?" -> list events with from/to for tomorrow, plus list tasks with status todo; summarise.
- "Move Anna's booking to Friday 3pm" -> list events search "Anna" -> confirm the right one -> update start_date and end_date (keep the same duration).
- "Who hasn't paid?" -> list events (page through with next_offset) and report those with payment_status not "fully_paid".
- "Add these 20 customers" -> create one at a time; report how many succeeded and which failed.
- "Mark all of today's tasks done" -> list, then update each; report results.

## 9. Not available through this key
Sending emails or SMS, approving/rejecting booking requests, business profile and working hours, statistics, files/attachments, team members (sub-users), payments/subscription, settings, and other accounts. Tell the user to do these in the SmartBookly dashboard.

## 10. Errors
Errors return {"error":"..."}:
- 401 — key missing, wrong or turned off. Ask the owner for a new key.
- 400 — bad request: unknown field, missing title/dates, wrong date format, end before start, bad status. Fix the field and try once more.
- 404 — record not found (wrong id, or already deleted). List again.
- 413 — request too big (limit 100 KB).
- 503 — temporary problem. Nothing is confirmed as saved; check with list before trying again.`;

type Key = { id: string; name: string; created_at: string; last_used_at: string | null; revoked_at: string | null };
type Log = { id: string; agent_name: string; action: string; resource_type: string; resource_id: string | null; created_at: string; details: unknown };

export default function AgentAccessDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { language } = useLanguage();
  const c = copy[(language as keyof typeof copy)] ?? copy.en;
  const { toast } = useToast();
  const [keys, setKeys] = useState<Key[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [name, setName] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [k, l] = await Promise.all([
      supabase.from("agent_api_keys").select("id,name,created_at,last_used_at,revoked_at").order("created_at", { ascending: false }),
      supabase.from("agent_activity_log").select("id,agent_name,action,resource_type,resource_id,created_at,details").order("created_at", { ascending: false }).limit(100),
    ]);
    setKeys((k.data as Key[]) ?? []);
    setLogs((l.data as Log[]) ?? []);
  }, []);

  useEffect(() => { if (open) { setSecret(null); load(); } }, [open, load]);

  const call = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("agent-api", { body });
    if (error || data?.error) throw new Error(data?.error || error?.message || "Error");
    return data;
  };

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try { const d = await call({ management: "create", name: name.trim() }); setSecret(d.secret); setName(""); load(); }
    catch (e) { toast({ title: (e as Error).message, variant: "destructive" }); }
    finally { setBusy(false); }
  };
  const revoke = async (id: string) => {
    try { await call({ management: "revoke", id }); load(); }
    catch (e) { toast({ title: (e as Error).message, variant: "destructive" }); }
  };
  const copyText = async (text: string) => { await navigator.clipboard.writeText(text); toast({ title: c.copied }); };
  const fmt = (d: string) => new Date(d).toLocaleString();
  const docs = agentDocs(ENDPOINT);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto min-w-0">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Bot className="h-5 w-5 text-primary" />{c.title}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{c.intro}</p>
        <Tabs defaultValue="keys" className="min-w-0">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="keys">{c.keys}</TabsTrigger>
            <TabsTrigger value="docs">{c.docs}</TabsTrigger>
            <TabsTrigger value="history">{c.history}</TabsTrigger>
          </TabsList>
          <TabsContent value="keys" className="space-y-3">
            <div className="flex gap-2">
              <Input className="text-base" maxLength={80} placeholder={c.name} value={name} onChange={e => setName(e.target.value)} />
              <Button onClick={create} disabled={busy || !name.trim()}><KeyRound className="h-4 w-4 mr-1" />{c.create}</Button>
            </div>
            {secret && (
              <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 space-y-2">
                <p className="text-sm font-medium">{c.once}</p>
                <div className="flex gap-2 min-w-0">
                  <code className="flex-1 min-w-0 break-all text-xs bg-muted p-2 rounded">{secret}</code>
                  <Button size="icon" variant="outline" onClick={() => copyText(secret)} aria-label={c.copied}><Copy className="h-4 w-4" /></Button>
                </div>
              </div>
            )}
            {keys.length === 0 ? <p className="text-sm text-muted-foreground">{c.none}</p> : keys.map(k => (
              <div key={k.id} className="flex items-center justify-between gap-2 rounded-lg border p-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{k.name}</p>
                  <p className="text-xs text-muted-foreground">{k.last_used_at ? `${c.lastUsed}: ${fmt(k.last_used_at)}` : c.never}</p>
                </div>
                {k.revoked_at ? <span className="text-xs text-muted-foreground">{c.revoked}</span> :
                  <Button size="sm" variant="outline" onClick={() => revoke(k.id)}><Trash2 className="h-4 w-4 mr-1" />{c.revoke}</Button>}
              </div>
            ))}
          </TabsContent>
          <TabsContent value="docs" className="space-y-2">
            <Button variant="outline" className="w-full" onClick={() => copyText(docs)}><Copy className="h-4 w-4 mr-1" />{c.copyDocs}</Button>
            <pre className="text-xs bg-muted p-3 rounded whitespace-pre-wrap break-words max-h-[50vh] overflow-y-auto">{docs}</pre>
          </TabsContent>
          <TabsContent value="history" className="space-y-2">
            {logs.length === 0 ? <p className="text-sm text-muted-foreground">{c.noHistory}</p> : logs.map(l => (
              <div key={l.id} className="rounded-lg border p-3 text-sm">
                <div className="flex justify-between gap-2"><span className="font-medium">{l.agent_name}</span><span className="text-xs text-muted-foreground">{fmt(l.created_at)}</span></div>
                <p className="text-muted-foreground">{l.action} · {l.resource_type}{(l.details as { title?: string })?.title ? ` · ${(l.details as { title?: string }).title}` : ""}</p>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
