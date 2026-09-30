import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";

const COPY = {
  en: { title: "Email delivery status", desc: "Every email sent from your account and whether it was delivered.", refresh: "Refresh", clear: "Clear", empty: "No emails sent yet.", all: "All", pending: "Pending", delivered: "Delivered", failed: "Failed" },
  es: { title: "Estado de entrega de correos", desc: "Cada correo enviado desde tu cuenta y si se entregó.", refresh: "Actualizar", clear: "Borrar", empty: "Aún no se han enviado correos.", all: "Todos", pending: "Pendiente", delivered: "Entregado", failed: "Fallido" },
  ka: { title: "ელფოსტის მიწოდების სტატუსი", desc: "თქვენი ანგარიშიდან გაგზავნილი ყველა წერილი და მისი მიწოდება.", refresh: "განახლება", clear: "გასუფთავება", empty: "წერილები ჯერ არ გაგზავნილა.", all: "ყველა", pending: "მოლოდინში", delivered: "მიწოდებულია", failed: "ვერ გაიგზავნა" },
};

type EmailLogRow = {
  id: string;
  recipient: string;
  subject: string | null;
  purpose: string | null;
  status: string;
  reason: string | null;
  created_at: string;
};

const group = (s: string) =>
  s === "delivered" || s === "sent" ? "delivered" : s === "failed" || s === "bounced" ? "failed" : "pending";

export const EmailDeliveryStatusPanel = () => {
  const { language } = useLanguage();
  const c = COPY[(language as keyof typeof COPY)] || COPY.en;
  const [rows, setRows] = useState<EmailLogRow[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "delivered" | "failed">("all");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("email_logs")
        .select("id, recipient, subject, purpose, status, reason, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (!error && data) setRows(data as EmailLogRow[]);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(() => {
      if (rows.some((r) => group(r.status) === "pending")) refresh();
    }, 30000);
    return () => clearInterval(t);
  }, [refresh, rows]);

  const clear = async () => {
    setBusy(true);
    try {
      await supabase.from("email_logs").delete().not("id", "is", null);
      setRows([]);
    } finally {
      setBusy(false);
    }
  };

  const counts = { all: rows.length, pending: 0, delivered: 0, failed: 0 };
  rows.forEach((r) => counts[group(r.status)]++);
  const visible = filter === "all" ? rows : rows.filter((r) => group(r.status) === filter);
  const variant = (g: string) => (g === "delivered" ? "green" : g === "failed" ? "destructive" : "secondary") as any;

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" /> {c.title}</CardTitle>
          <CardDescription>{c.desc}</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={refresh} disabled={busy} className="gap-1.5">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} {c.refresh}
          </Button>
          {rows.length > 0 && (
            <Button size="sm" variant="ghost" onClick={clear} disabled={busy} className="gap-1.5 text-destructive">
              <Trash2 className="h-4 w-4" /> {c.clear}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {(["all", "pending", "delivered", "failed"] as const).map((k) => (
            <Button key={k} size="sm" variant={filter === k ? "default" : "outline"} onClick={() => setFilter(k)}>
              {c[k]} ({counts[k]})
            </Button>
          ))}
        </div>
        {visible.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">{c.empty}</p>
        ) : (
          <ul className="divide-y rounded-md border max-h-96 overflow-y-auto">
            {visible.map((r) => {
              const g = group(r.status);
              return (
                <li key={r.id} className="p-3 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-sm break-all">{r.recipient}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
                      <Badge variant={variant(g)}>{c[g]}{g === "pending" && r.status !== "pending" ? ` · ${r.status}` : ""}</Badge>
                    </div>
                  </div>
                  {r.subject && <p className="text-xs text-muted-foreground line-clamp-2 break-words">{r.subject}</p>}
                  {r.reason && <p className="text-xs text-destructive break-words">{r.reason}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};
