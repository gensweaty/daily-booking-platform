import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Mail, Reply, Search, Loader2, Paperclip } from "lucide-react";
import { EMAIL_COPY } from "./emailHistoryCopy";
import { emailStatus, relatedReplies, type EmailRecord, type ReceivedEmail, type MessageDetails } from "./emailHistoryModel";

const PAGE_SIZE = 25;
type Selection = { kind: "sent"; row: EmailRecord } | { kind: "received"; row: ReceivedEmail };
// An empty sandbox and CSP prevent scripts, forms, remote images and tracking pixels.
const safeDocument = (html: string) => `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src 'none'; base-uri 'none'; form-action 'none'">${html}`;

export function EmailHistory({ refreshKey, onReply }: { refreshKey: number; onReply: (email: string) => void }) {
  const { language } = useLanguage();
  const c = EMAIL_COPY[language as keyof typeof EMAIL_COPY] || EMAIL_COPY.en;
  const [kind, setKind] = useState("sent");
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [sort, setSort] = useState("newest");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [sent, setSent] = useState<EmailRecord[]>([]);
  const [received, setReceived] = useState<ReceivedEmail[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [details, setDetails] = useState<MessageDetails | null>(null);
  const [replies, setReplies] = useState<ReceivedEmail[]>([]);
  const [detailBusy, setDetailBusy] = useState(false);
  const [detailError, setDetailError] = useState(false);
  const request = useRef(0);
  useEffect(() => { const timer = setTimeout(() => { setTerm(search.trim()); setPage(0); }, 300); return () => clearTimeout(timer); }, [search]);
  const load = useCallback(async () => {
    const seq = ++request.current;
    setBusy(true); setError(false);
    try {
      const isSent = kind === "sent";
      const select: string = isSent ? "id,recipient,subject,status,reason,created_at,delivered_at,opened_at,clicked_at" : "id,sender,recipient,subject,body,received_at";
      let query = supabase.from(isSent ? "email_logs" : "inbound_messages").select(select, { count: "exact" });
      if (!isSent) query = query.eq("channel", "email");
      if (isSent && status !== "all") query = query.eq("status", status);
      // Escape filter grammar, then use wildcard search only on text fields.
      const value = term.replace(/[\\%_(),.\"']/g, " ").trim();
      if (value) query = query.or(`${isSent ? "recipient" : "sender"}.ilike.%${value}%,subject.ilike.%${value}%`);
      const column = sort === "recipient" ? isSent ? "recipient" : "sender" : sort === "subject" ? "subject" : isSent ? "created_at" : "received_at";
      const { data, error: err, count } = await query.order(column, { ascending: sort !== "newest" }).order("id").range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1).returns<(EmailRecord | ReceivedEmail)[]>();
      if (err) throw err;
      if (seq !== request.current) return;
      const last = Math.max(0, Math.ceil((count || 0) / PAGE_SIZE) - 1);
      if (page > last) { setPage(last); return; }
      setTotal(count || 0);
      if (isSent) setSent((data || []) as EmailRecord[]); else setReceived((data || []) as ReceivedEmail[]);
    } catch { if (seq === request.current) setError(true); }
    finally { if (seq === request.current) setBusy(false); }
  }, [kind, term, sort, status, page]);
  useEffect(() => { void load(); }, [load, refreshKey]);
  useEffect(() => { const timer = setInterval(() => { if (document.visibilityState === "visible") void load(); }, 30000); return () => clearInterval(timer); }, [load]);
  useEffect(() => {
    if (!selection) return;
    let active = true;
    setDetails(null); setReplies([]); setDetailBusy(true); setDetailError(false);
    const fetchDetails = async () => {
      try {
        if (selection.kind === "received") {
          const { data, error: err } = await supabase.from("inbound_messages").select("html,body,sender,recipient").eq("id", selection.row.id).single();
          if (err) throw err;
          if (active) setDetails({ from: data.sender, to: data.recipient ? [data.recipient] : [], html: data.html || undefined, text: data.body || undefined });
        } else {
          const { data, error: err } = await supabase.from("email_logs").select("message_details").eq("id", selection.row.id).single();
          if (err) throw err;
          if (active) setDetails(data.message_details as MessageDetails | null);
          // Page through candidates; only show replies with matching sender + subject.
          const candidates: ReceivedEmail[] = [];
          for (let offset = 0; ; offset += 1000) {
            const { data: batch, error: re } = await supabase.from("inbound_messages").select("id,sender,recipient,subject,body,html,received_at").eq("channel", "email").gte("received_at", selection.row.created_at).ilike("sender", `%${selection.row.recipient.replace(/[%_]/g, "")}%`).order("received_at").order("id").range(offset, offset + 999);
            if (re) throw re;
            if (!active) return;
            candidates.push(...(batch || []));
            if ((batch || []).length < 1000) break;
          }
          if (active) setReplies(relatedReplies(selection.row, candidates));
        }
      } catch { if (active) setDetailError(true); }
      finally { if (active) setDetailBusy(false); }
    };
    void fetchDetails();
    return () => { active = false; };
  }, [selection]);
  const statusBadge = (row: EmailRecord) => {
    const s = emailStatus(row);
    return <Badge variant={["failed", "bounced", "spam"].includes(s) ? "destructive" : ["opened", "clicked", "delivered"].includes(s) ? "green" : "secondary"}>{c[s as keyof typeof c] || s}</Badge>;
  };
  const body = (value: MessageDetails | null) => value?.html ? <iframe title={c.details} sandbox="" referrerPolicy="no-referrer" srcDoc={safeDocument(value.html)} className="h-[40vh] w-full rounded-md border bg-background" /> : <p className="whitespace-pre-wrap break-words text-sm">{value?.text || c.unavailable}</p>;
  const selectedRow = selection?.row;
  return <div className="space-y-4 min-w-0">
    <div className="flex flex-wrap gap-2">{["sent", "received"].map((k) => <Button key={k} size="sm" variant={kind === k ? "default" : "outline"} onClick={() => { setKind(k); setPage(0); }}>{k === "sent" ? c.outgoing : c.received}</Button>)}</div>
    <div className="flex flex-wrap gap-2">
      <div className="relative min-w-0 flex-1 basis-64"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label={c.search} placeholder={c.search} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 text-base" /></div>
      {kind === "sent" && <Select value={status} onValueChange={(v) => { setStatus(v); setPage(0); }}><SelectTrigger aria-label={c.all} className="w-full sm:w-44"><SelectValue /></SelectTrigger><SelectContent>{["all", "sent", "pending", "delivered", "opened", "clicked", "delayed", "bounced", "spam", "failed"].map((s) => <SelectItem key={s} value={s}>{c[s as keyof typeof c]}</SelectItem>)}</SelectContent></Select>}
      <Select value={sort} onValueChange={(v) => { setSort(v); setPage(0); }}><SelectTrigger aria-label={c.newest} className="w-full sm:w-44"><SelectValue /></SelectTrigger><SelectContent>{["newest", "oldest", "recipient", "subject"].map((s) => <SelectItem key={s} value={s}>{c[s as keyof typeof c]}</SelectItem>)}</SelectContent></Select>
    </div>
    {error ? <p role="alert" className="text-sm text-destructive">{c.error}</p> : <div aria-busy={busy} className="divide-y rounded-lg border">
      {busy && !sent.length && !received.length ? <p className="p-8 text-center">{c.loading}</p> : (kind === "sent" ? sent : received).length === 0 ? <p className="p-8 text-center text-muted-foreground">{c.empty}</p> : kind === "sent" ? sent.map((row) => <div key={row.id} className="flex items-center gap-2 p-3">
        <Button variant="ghost" className="h-auto min-w-0 flex-1 justify-start whitespace-normal p-2 text-left" onClick={() => setSelection({ kind: "sent", row })}><div className="min-w-0 space-y-1"><p className="break-all font-medium">{row.recipient}</p><p className="break-words font-normal">{row.subject || "—"}</p><p className="text-xs font-normal text-muted-foreground">{new Date(row.created_at).toLocaleString(language)}</p>{row.reason && <p className="break-words text-xs text-destructive">{row.reason}</p>}</div></Button>
        <div className="flex shrink-0 flex-col items-end gap-2">{statusBadge(row)}<Button variant="ghost" size="icon" aria-label={c.reply} title={c.reply} onClick={() => onReply(row.recipient)}><Reply className="h-4 w-4" /></Button></div>
      </div>) : received.map((row) => <div key={row.id} className="flex items-center gap-2 p-3"><Button variant="ghost" className="h-auto min-w-0 flex-1 justify-start whitespace-normal text-left" onClick={() => setSelection({ kind: "received", row })}><div className="min-w-0 space-y-1"><p className="break-all">{row.sender}</p><p className="break-words font-normal">{row.subject || "—"}</p><p className="text-xs font-normal text-muted-foreground">{new Date(row.received_at).toLocaleString(language)}</p></div></Button><Button variant="ghost" size="icon" aria-label={c.reply} onClick={() => onReply(row.sender)}><Reply className="h-4 w-4" /></Button></div>)}
    </div>}
    <div className="flex items-center justify-between gap-2 text-sm"><span>{c.page} {page + 1} {c.of} {Math.max(1, Math.ceil(total / PAGE_SIZE))} · {total}{busy && <Loader2 className="ml-2 inline h-4 w-4 animate-spin" />}</span><div className="flex gap-1"><Button variant="outline" size="icon" disabled={!page || busy} aria-label={c.previous} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button><Button variant="outline" size="icon" disabled={(page + 1) * PAGE_SIZE >= total || busy} aria-label={c.next} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button></div></div>
    <p className="text-xs text-muted-foreground">{kind === "sent" ? c.tracking : c.receivedInfo}</p>
    <Dialog open={!!selection} onOpenChange={(open) => { if (!open) setSelection(null); }}><DialogContent className="sm:max-w-4xl"><DialogHeader className="border-b pb-4 pr-8"><DialogTitle className="flex items-start gap-2 break-words"><Mail className="h-5 w-5 shrink-0 text-primary" />{selectedRow?.subject || c.details}</DialogTitle><DialogDescription>{c.details}</DialogDescription></DialogHeader>
      {selection && <><dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm"><dt className="text-muted-foreground">{c.to}</dt><dd className="break-all">{details?.to?.join(", ") || (selection.kind === "sent" ? selection.row.recipient : selection.row.recipient) || "—"}</dd>{details?.from && <><dt className="text-muted-foreground">{c.from}</dt><dd className="break-all">{details.from}</dd></>}{["cc", "bcc", "reply_to"].map((k) => { const val = details?.[k as keyof MessageDetails]; return val && (Array.isArray(val) ? val.length : true) ? <div key={k} className="contents"><dt className="text-muted-foreground">{k === "reply_to" ? c.replyTo : k.toUpperCase()}</dt><dd className="break-all">{Array.isArray(val) ? val.join(", ") : String(val)}</dd></div> : null; })}<dt className="text-muted-foreground">{c.date}</dt><dd>{new Date(selection.kind === "sent" ? selection.row.created_at : selection.row.received_at).toLocaleString(language)}</dd></dl>
      {selection.kind === "sent" && <div className="flex flex-wrap items-center gap-3">{statusBadge(selection.row)}{(["delivered_at", "opened_at", "clicked_at"] as const).map((k) => selection.row[k] ? <span key={k} className="text-xs text-muted-foreground">{c[k === "delivered_at" ? "delivered" : k === "opened_at" ? "opened" : "clicked"]}: {new Date(selection.row[k] || "").toLocaleString(language)}</span> : null)}</div>}
      {detailError && <p role="alert" className="text-destructive text-sm">{c.error}</p>}{detailBusy ? <p>{c.loading}</p> : body(details)}
      {!!details?.attachments?.length && <div className="border-t pt-3"><p className="mb-2 flex items-center gap-2 text-sm font-medium"><Paperclip className="h-4 w-4" />{c.attachments}</p>{details.attachments.map((a, i) => <p key={i} className="break-all text-sm text-muted-foreground">{a.filename}</p>)}</div>}
      {selection.kind === "sent" && <section className="space-y-3 border-t pt-4"><h3 className="text-sm font-semibold">{c.replies} ({replies.length})</h3>{!detailBusy && !replies.length && <p className="text-xs text-muted-foreground">{c.noReplies}</p>}{replies.map((r) => <div key={r.id} className="space-y-2 border-l-2 border-primary pl-3"><p className="break-all text-sm font-medium">{r.sender}</p><p className="text-xs text-muted-foreground">{new Date(r.received_at).toLocaleString(language)}</p>{body({ html: r.html || undefined, text: r.body || undefined })}</div>)}</section>}
      <Button className="justify-self-end gap-2" onClick={() => { onReply(selection.kind === "sent" ? selection.row.recipient : selection.row.sender); setSelection(null); }}><Reply className="h-4 w-4" />{c.reply}</Button></>}
    </DialogContent></Dialog>
  </div>;
}