import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { getSmsLog, refreshSmsStatuses, clearSmsLog, getGatewayCreds, SmsLogEntry } from "@/lib/smsGateway";

const COPY = {
  en: { title: "Delivery status", desc: "Every message sent from this device and whether it was delivered.", refresh: "Refresh", clear: "Clear", empty: "No messages sent yet.", all: "All", queued: "Pending", delivered: "Delivered", failed: "Failed" },
  es: { title: "Estado de entrega", desc: "Cada mensaje enviado desde este dispositivo y si se entregó.", refresh: "Actualizar", clear: "Borrar", empty: "Aún no se han enviado mensajes.", all: "Todos", queued: "Pendiente", delivered: "Entregado", failed: "Fallido" },
  ka: { title: "მიწოდების სტატუსი", desc: "ამ მოწყობილობიდან გაგზავნილი ყველა შეტყობინება და მისი მიწოდება.", refresh: "განახლება", clear: "გასუფთავება", empty: "შეტყობინებები ჯერ არ გაგზავნილა.", all: "ყველა", queued: "მოლოდინში", delivered: "მიწოდებულია", failed: "ვერ გაიგზავნა" },
};

const group = (s: string) => (s === "delivered" ? "delivered" : s === "failed" ? "failed" : "queued");

export const SmsDeliveryStatusPanel = () => {
  const { language } = useLanguage();
  const c = COPY[(language as keyof typeof COPY)] || COPY.en;
  const [log, setLog] = useState<SmsLogEntry[]>(getSmsLog());
  const [filter, setFilter] = useState<"all" | "queued" | "delivered" | "failed">("all");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const h = () => setLog(getSmsLog());
    window.addEventListener("sms-log-updated", h);
    return () => window.removeEventListener("sms-log-updated", h);
  }, []);

  const refresh = async () => {
    if (!getGatewayCreds()) return;
    setBusy(true);
    try { await refreshSmsStatuses(); } finally { setBusy(false); }
  };

  useEffect(() => {
    refresh();
    const t = setInterval(() => { if (getSmsLog().some((e) => group(e.status) === "queued")) refresh(); }, 30000);
    return () => clearInterval(t);
  }, []);

  const counts = { all: log.length, queued: 0, delivered: 0, failed: 0 };
  log.forEach((e) => counts[group(e.status)]++);
  const rows = filter === "all" ? log : log.filter((e) => group(e.status) === filter);
  const variant = (g: string) => (g === "delivered" ? "green" : g === "failed" ? "destructive" : "secondary") as any;

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> {c.title}</CardTitle>
          <CardDescription>{c.desc}</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={refresh} disabled={busy} className="gap-1.5">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} {c.refresh}
          </Button>
          {log.length > 0 && (
            <Button size="sm" variant="ghost" onClick={clearSmsLog} className="gap-1.5 text-destructive">
              <Trash2 className="h-4 w-4" /> {c.clear}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {(["all", "queued", "delivered", "failed"] as const).map((k) => (
            <Button key={k} size="sm" variant={filter === k ? "default" : "outline"} onClick={() => setFilter(k)}>
              {c[k]} ({counts[k]})
            </Button>
          ))}
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">{c.empty}</p>
        ) : (
          <ul className="divide-y rounded-md border max-h-96 overflow-y-auto">
            {rows.map((e) => {
              const g = group(e.status);
              return (
                <li key={e.key} className="p-3 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-sm">{e.to}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleString()}</span>
                      <Badge variant={variant(g)}>{c[g]}{g === "queued" && e.status !== "queued" ? ` · ${e.status}` : ""}</Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 break-words">{e.text}</p>
                  {e.error && <p className="text-xs text-destructive break-words">{e.error}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};
