import { useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, Send, X, Loader2, AtSign, Eye, AlertTriangle, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { MERGE_TAGS, renderTemplate, detectTags } from "./emailMergeTags";
import { sendSms, getGatewayCreds } from "@/lib/smsGateway";

const KNOWN_TOKENS = new Set(MERGE_TAGS.map((t) => t.token));
const MAX_LEN = 1600;

/** Digits-only sanity check; keeps + prefix. */
export const getCustomerPhone = (c: any): string => {
  const raw = String(c?.user_number || "").trim();
  const cleaned = raw.replace(/[^\d+]/g, "");
  const digits = cleaned.replace(/\D/g, "");
  return digits.length >= 6 ? cleaned : "";
};

const isValidPhone = (v: string) => v.replace(/\D/g, "").length >= 6;

const segments = (text: string) => {
  const unicode = /[^\u0000-\u007F]/.test(text);
  const size = unicode ? 70 : 160;
  const multi = unicode ? 67 : 153;
  if (text.length <= size) return text.length === 0 ? 0 : 1;
  return Math.ceil(text.length / multi);
};

const renderParts = (value: string) =>
  (value || "").split(/(@[a-zA-Z_]+)/g).map((part, i) => {
    if (!part.startsWith("@")) return <span key={i}>{part}</span>;
    const token = part.slice(1);
    return (
      <span key={i} className={KNOWN_TOKENS.has(token) ? "merge-tag merge-tag--valid" : "merge-tag merge-tag--unknown"}>
        {part}
      </span>
    );
  });

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: any[];
}

export const SmsComposerDialog = ({ open, onOpenChange, customers }: Props) => {
  const { toast } = useToast();

  const initialRecipients = useMemo(() => {
    const seen = new Set<string>();
    const list: { phone: string; customer: any }[] = [];
    (customers || []).forEach((c) => {
      const phone = getCustomerPhone(c);
      if (!phone || seen.has(phone)) return;
      seen.add(phone);
      list.push({ phone, customer: c });
    });
    return list;
  }, [customers]);

  const skipped = (customers?.length || 0) - initialRecipients.length;

  const [recipients, setRecipients] = useState(initialRecipients);
  const [toInput, setToInput] = useState("");
  const [message, setMessage] = useState("");
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setRecipients(initialRecipients);
      setProgress(0);
      setPreviewIndex(null);
    }
  }, [open, initialRecipients]);

  const detected = useMemo(() => detectTags(message), [message]);
  const gatewayReady = !!getGatewayCreds();

  const addTypedRecipients = () => {
    const parts = toInput.split(/[,;\s]+/).map((p) => p.trim()).filter(Boolean);
    if (!parts.length) return;
    const invalid = parts.filter((p) => !isValidPhone(p));
    const valid = parts.filter(isValidPhone);
    if (valid.length) {
      setRecipients((prev) => {
        const seen = new Set(prev.map((r) => r.phone));
        return [...prev, ...valid.filter((p) => !seen.has(p)).map((phone) => ({ phone, customer: null }))];
      });
    }
    setToInput("");
    if (invalid.length) {
      toast({ title: "Invalid numbers skipped", description: invalid.join(", "), variant: "destructive" });
    }
  };

  const insertTag = (token: string) => {
    const el = textareaRef.current;
    const tag = `@${token}`;
    if (!el) {
      setMessage((m) => `${m}${tag}`);
      return;
    }
    const start = el.selectionStart ?? message.length;
    const end = el.selectionEnd ?? message.length;
    const next = `${message.slice(0, start)}${tag}${message.slice(end)}`;
    setMessage(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + tag.length, start + tag.length);
    });
  };

  const previewCustomer = previewIndex != null ? recipients[previewIndex]?.customer : null;
  const previewText = previewIndex != null ? renderTemplate(message, previewCustomer) : message;

  const handleSend = async () => {
    if (!recipients.length) {
      toast({ title: "Add at least one number", variant: "destructive" });
      return;
    }
    if (!message.trim()) {
      toast({ title: "Message is empty", variant: "destructive" });
      return;
    }
    if (!gatewayReady) {
      toast({
        title: "SMS gateway not configured",
        description: "Add your gateway username and password in My Business first.",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    setProgress(2);
    const failures: string[] = [];
    let sent = 0;

    for (let i = 0; i < recipients.length; i++) {
      const r = recipients[i];
      const body = renderTemplate(message, r.customer).slice(0, MAX_LEN);
      try {
        await sendSms(r.phone, body);
        sent++;
      } catch (e: any) {
        failures.push(`${r.phone}: ${e?.message || "failed"}`);
      }
      setProgress(Math.round(((i + 1) / recipients.length) * 100));
      // gentle throttle so the phone gateway keeps up
      if (i < recipients.length - 1) await new Promise((res) => setTimeout(res, 400));
    }

    setSending(false);
    toast({
      title: failures.length ? `Sent ${sent}, failed ${failures.length}` : `Sent ${sent} SMS`,
      description: failures.length ? failures.join(" · ") : "Personalized messages queued on your phone.",
      variant: failures.length ? "destructive" : undefined,
    });
    if (!failures.length) onOpenChange(false);
  };

  const charCount = message.length;

  return (
    <Dialog open={open} onOpenChange={(v) => !sending && onOpenChange(v)}>
      <DialogContent className="max-w-2xl w-[96vw] max-h-[92vh] min-w-0 p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 py-3 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <MessageSquare className="h-4 w-4 text-primary" />
            Send SMS {recipients.length > 0 && <Badge variant="secondary">{recipients.length}</Badge>}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(92vh-8.5rem)]">
          <div className="p-5 space-y-4 min-w-0">
            {!gatewayReady && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs">
                <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
                <span>
                  Your SMS gateway isn't connected yet. Open <strong>My Business</strong> and save your gateway username and
                  password to start sending.
                </span>
              </div>
            )}

            {/* Recipients */}
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">To</Label>
              <div className="flex flex-wrap gap-1.5 rounded-md border border-input bg-background p-2">
                {recipients.map((r, i) => (
                  <span key={r.phone} className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
                    {r.phone}
                    <button
                      type="button"
                      aria-label={`Remove ${r.phone}`}
                      onClick={() => setRecipients((prev) => prev.filter((_, idx) => idx !== i))}
                      className="rounded-full p-0.5 hover:bg-destructive hover:text-destructive-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <input
                  value={toInput}
                  onChange={(e) => setToInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "," || e.key === " ") {
                      e.preventDefault();
                      addTypedRecipients();
                    }
                  }}
                  onBlur={addTypedRecipients}
                  placeholder={recipients.length ? "Add another…" : "+995555123456"}
                  className="flex-1 min-w-[10rem] bg-transparent text-base md:text-sm outline-none"
                />
              </div>
              {skipped > 0 && (
                <p className="text-xs text-muted-foreground">
                  {skipped} selected customer{skipped === 1 ? "" : "s"} had no valid phone number and{" "}
                  {skipped === 1 ? "was" : "were"} skipped.
                </p>
              )}
            </div>

            {/* Personalization tags */}
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <AtSign className="h-4 w-4 text-primary" /> Personalization tags
              </div>
              <p className="text-xs text-muted-foreground">
                Click a tag to insert it. Each person receives their own name and details instead of the tag.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {MERGE_TAGS.map((t) => {
                  const isUsed = detected.used.includes(t.token);
                  return (
                    <button
                      key={t.token}
                      type="button"
                      onClick={() => insertTag(t.token)}
                      title={`Insert ${t.label}`}
                      className={cn(
                        "rounded-full border px-2 py-0.5 font-mono text-[11px] transition-colors",
                        isUsed
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-primary hover:bg-primary/10"
                      )}
                    >
                      @{t.token}
                    </button>
                  );
                })}
              </div>
              {detected.unknown.length > 0 && (
                <p className="flex items-center gap-1.5 text-xs text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" /> Unknown tag{detected.unknown.length > 1 ? "s" : ""}:{" "}
                  {detected.unknown.map((u) => `@${u}`).join(", ")} — they will be sent as plain text.
                </p>
              )}
              {detected.used.length > 0 && detected.unknown.length === 0 && (
                <p className="flex items-center gap-1.5 text-xs text-primary">
                  <Check className="h-3.5 w-3.5" /> {detected.used.length} tag
                  {detected.used.length > 1 ? "s" : ""} will be personalized.
                </p>
              )}
            </div>

            {/* Message */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Message</Label>
                <div className="flex items-center gap-2">
                  {recipients.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1.5 text-xs"
                      onClick={() => setPreviewIndex((v) => (v == null ? 0 : null))}
                    >
                      <Eye className="h-3.5 w-3.5" /> {previewIndex == null ? "Preview" : "Edit"}
                    </Button>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {charCount}/{MAX_LEN} · {segments(previewText)} SMS
                  </span>
                </div>
              </div>

              {previewIndex == null ? (
                <div className="relative">
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words rounded-md p-3 text-base md:text-sm"
                  >
                    {renderParts(message)}
                  </div>
                  <textarea
                    ref={textareaRef}
                    value={message}
                    maxLength={MAX_LEN}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Hi @first_name, reminder about your appointment on @event_date."
                    className="relative min-h-[160px] w-full resize-y rounded-md border border-input bg-transparent p-3 text-base md:text-sm text-transparent caret-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Showing as</span>
                    <select
                      value={previewIndex}
                      onChange={(e) => setPreviewIndex(Number(e.target.value))}
                      className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                    >
                      {recipients.map((r, i) => (
                        <option key={r.phone} value={i}>
                          {r.phone}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="min-h-[160px] whitespace-pre-wrap break-words rounded-md border border-border bg-muted/40 p-3 text-sm">
                    {previewText || <span className="text-muted-foreground">Nothing to preview yet.</span>}
                  </div>
                </div>
              )}
            </div>

            {sending && <Progress value={progress} className="h-2" />}
          </div>
        </ScrollArea>

        <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
          <p className="text-xs text-muted-foreground">Messages are sent one by one from your own phone gateway.</p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={sending}>
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={sending} className="gap-2">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sending ? `Sending ${progress}%` : `Send${recipients.length ? ` (${recipients.length})` : ""}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SmsComposerDialog;
