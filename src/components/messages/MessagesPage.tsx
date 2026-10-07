import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, MessageSquare, RefreshCw, Reply, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { EmailComposerDialog } from "@/components/crm/EmailComposerDialog";
import { SmsComposerDialog } from "@/components/crm/SmsComposerDialog";
import { getSmsLog, getGatewayCreds, registerInboundWebhook } from "@/lib/smsGateway";
import { EmailDeliveryStatusPanel } from "@/components/business/EmailDeliveryStatusPanel";
const SmsSettingsSection = lazy(() => import("@/components/business/SmsSettingsSection"));

const COPY = {
  en: { email: "Email", sms: "SMS", newEmail: "New email", newSms: "New SMS", refresh: "Refresh", empty: "Nothing here yet.", reply: "Reply", enableSms: "Turn on SMS replies", smsOn: "SMS replies turned on", delivered: "Delivered", failed: "Failed", pending: "Pending", replyTag: "Reply", inbox: "Messages", settings: "Settings" },
  es: { email: "Correo", sms: "SMS", newEmail: "Nuevo correo", newSms: "Nuevo SMS", refresh: "Actualizar", empty: "Aún no hay nada.", reply: "Responder", enableSms: "Activar respuestas SMS", smsOn: "Respuestas SMS activadas", delivered: "Entregado", failed: "Fallido", pending: "Pendiente", replyTag: "Respuesta", inbox: "Mensajes", settings: "Ajustes" },
  ka: { email: "ელფოსტა", sms: "SMS", newEmail: "ახალი წერილი", newSms: "ახალი SMS", refresh: "განახლება", empty: "ჯერ ცარიელია.", reply: "პასუხი", enableSms: "SMS პასუხების ჩართვა", smsOn: "SMS პასუხები ჩართულია", delivered: "მიწოდებულია", failed: "ვერ გაიგზავნა", pending: "მოლოდინში", replyTag: "პასუხი", inbox: "შეტყობინებები", settings: "პარამეტრები" },
};

const group = (s: string) =>
  ["delivered", "sent", "opened", "clicked"].includes(s) ? "delivered" : ["failed", "bounced", "spam"].includes(s) ? "failed" : "pending";

type Item = { id: string; who: string; title?: string; text?: string; status?: string; inbound: boolean; at: string };

export const MessagesPage = ({ composeRequest }: { composeRequest: { kind: "email" | "sms"; at: number } | null }) => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const c = COPY[language as keyof typeof COPY] || COPY.en;
  const [tab, setTab] = useState<"email" | "sms">("email");
  const [view, setView] = useState<"inbox" | "settings">("inbox");
  const [emailOpen, setEmailOpen] = useState(false);
  const [smsOpen, setSmsOpen] = useState(false);
  const [prefill, setPrefill] = useState<any[]>([]);
  const [emails, setEmails] = useState<Item[]>([]);
  const [smsItems, setSmsItems] = useState<Item[]>([]);

  useEffect(() => {
    if (!composeRequest) return;
    setTab(composeRequest.kind);
    setPrefill([]);
    composeRequest.kind === "email" ? setEmailOpen(true) : setSmsOpen(true);
  }, [composeRequest]);

  const load = useCallback(async () => {
    const [{ data: logs }, { data: inbound }] = await Promise.all([
      supabase.from("email_logs" as any).select("id,recipient,subject,status,reason,created_at").order("created_at", { ascending: false }).limit(200),
      supabase.from("inbound_messages" as any).select("id,channel,sender,subject,body,received_at").order("received_at", { ascending: false }).limit(200),
    ]);
    const inb = ((inbound as any[]) || []).map((m) => ({ id: m.id, who: m.sender, title: m.subject, text: m.body, inbound: true, at: m.received_at, channel: m.channel }));
    setEmails([
      ...((logs as any[]) || []).map((l) => ({ id: l.id, who: l.recipient, title: l.subject, text: l.reason, status: l.status, inbound: false, at: l.created_at })),
      ...inb.filter((m) => m.channel === "email"),
    ].sort((a, b) => b.at.localeCompare(a.at)));
    setSmsItems([
      ...getSmsLog().map((s) => ({ id: s.key, who: s.to, text: s.error ? `${s.text} — ${s.error}` : s.text, status: s.status, inbound: false, at: s.createdAt })),
      ...inb.filter((m) => m.channel === "sms"),
    ].sort((a, b) => b.at.localeCompare(a.at)));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    window.addEventListener("sms-log-updated", load);
    return () => { clearInterval(t); window.removeEventListener("sms-log-updated", load); };
  }, [load]);

  const enableSmsReplies = async () => {
    try {
      if (!getGatewayCreds()) throw new Error("Connect your phone in My Business → SMS Settings first.");
      const { data, error } = await supabase.functions.invoke("sms-inbound?action=url", { method: "GET" });
      if (error || !data?.url) throw new Error(error?.message || "Could not get link");
      await registerInboundWebhook(data.url);
      toast({ title: c.smsOn });
    } catch (e) {
      toast({ title: c.enableSms, description: (e as Error).message, variant: "destructive" });
    }
  };

  const replyTo = (it: Item) => {
    const who = it.who.match(/<([^>]+)>/)?.[1] || it.who;
    if (tab === "email") { setPrefill([{ social_network_link: who, title: who }]); setEmailOpen(true); }
    else { setPrefill([{ user_number: who, title: who }]); setSmsOpen(true); }
  };

  const List = ({ items }: { items: Item[] }) =>
    items.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">{c.empty}</p> : (
      <div className="space-y-2">
        {items.map((it) => {
          const g = it.status ? group(it.status) : "";
          return (
            <div key={it.id} className={`rounded-lg border p-3 ${it.inbound ? "border-primary/40 bg-primary/5" : ""}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{it.inbound && <Reply className="mr-1 inline h-3.5 w-3.5 text-primary" />}{it.who}</p>
                  {it.title && <p className="truncate text-sm">{it.title}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {it.inbound ? <Badge>{c.replyTag}</Badge> : <Badge variant={g === "failed" ? "destructive" : g === "delivered" ? "default" : "secondary"}>{c[g as "delivered"]}</Badge>}
                  <Button size="sm" variant="ghost" onClick={() => replyTo(it)}>{c.reply}</Button>
                </div>
              </div>
              {it.text && <p className="mt-1 whitespace-pre-wrap break-words text-xs text-muted-foreground">{it.text}</p>}
              <p className="mt-1 text-[11px] text-muted-foreground">{new Date(it.at).toLocaleString()}</p>
            </div>
          );
        })}
      </div>
    );

  const Section = ({ list, settings }: { list: React.ReactNode; settings: React.ReactNode }) => (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border bg-muted/30 p-1">
        {(["inbox", "settings"] as const).map((v) => (
          <Button key={v} size="sm" variant={view === v ? "default" : "ghost"} onClick={() => setView(v)} className="gap-1.5">
            {v === "inbox" ? <Mail className="h-4 w-4" /> : <Settings className="h-4 w-4" />}{v === "inbox" ? c.inbox : c.settings}
          </Button>
        ))}
      </div>
      {view === "inbox" ? list : <Suspense fallback={<p className="py-6 text-center text-sm text-muted-foreground">…</p>}>{settings}</Suspense>}
    </div>
  );

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="email" className="gap-1.5"><Mail className="h-4 w-4" />{c.email}</TabsTrigger>
            <TabsTrigger value="sms" className="gap-1.5"><MessageSquare className="h-4 w-4" />{c.sms}</TabsTrigger>
          </TabsList>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={load} className="gap-1.5"><RefreshCw className="h-4 w-4" />{c.refresh}</Button>
            {tab === "sms" && <Button size="sm" variant="outline" onClick={enableSmsReplies}>{c.enableSms}</Button>}
            <Button size="sm" onClick={() => { setPrefill([]); tab === "email" ? setEmailOpen(true) : setSmsOpen(true); }}>
              {tab === "email" ? c.newEmail : c.newSms}
            </Button>
          </div>
        </div>
        <TabsContent value="email" className="mt-4"><Section list={<List items={emails} />} settings={<EmailDeliveryStatusPanel />} /></TabsContent>
        <TabsContent value="sms" className="mt-4"><Section list={<List items={smsItems} />} settings={<SmsSettingsSection />} /></TabsContent>
      </Tabs>
      {emailOpen && <EmailComposerDialog open={emailOpen} onOpenChange={(v) => { setEmailOpen(v); if (!v) load(); }} customers={prefill} plainLayout />}
      {smsOpen && <SmsComposerDialog open={smsOpen} onOpenChange={(v) => { setSmsOpen(v); if (!v) load(); }} customers={prefill} />}
    </div>
  );
};
