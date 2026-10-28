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

export const agentDocs = (endpoint: string) => `# SmartBookly Agent API

You act on ONE SmartBookly account. Never claim a change succeeded unless the response has "ok": true.

Endpoint: ${endpoint}
Auth header: Authorization: Bearer YOUR_KEY

GET  -> lists available resources and fields.
POST -> JSON body: {"action": "...", "resource": "...", "id": "...", "data": {...}, "filters": {...}}

Resources: events, customers, tasks, notes, reminders
Actions: list, get, create, update, delete
- list filters: limit (1-200, default 50), offset, search (title), from, to (ISO dates), status (tasks: todo | inprogress | done)
- update only changes the fields you send; others stay as they are.
- events/customers need start_date and end_date (ISO 8601, end after start).
- reminders need remind_at (ISO 8601, in the future).
- delete hides the item (events, customers, reminders) and is recorded in history.

Before updating or deleting, use list with search to find the exact id. If several match, ask the user.

Examples:
{"action":"list","resource":"events","filters":{"from":"2026-11-01T00:00:00Z","limit":20}}
{"action":"create","resource":"tasks","data":{"title":"Call supplier","status":"todo"}}
{"action":"update","resource":"tasks","id":"<uuid>","data":{"status":"done"}}
{"action":"create","resource":"reminders","data":{"title":"Interview","remind_at":"2026-11-03T09:00:00Z"}}

Errors return {"error": "..."} with HTTP 4xx/5xx. Report the error to the user; do not retry blindly.`;

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
