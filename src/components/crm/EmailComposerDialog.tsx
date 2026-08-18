import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, List, ListOrdered,
  Heading1, Heading2, Quote, Link as LinkIcon, Image as ImageIcon, Code2,
  Undo2, Redo2, Eye, Send, X, Loader2, Paperclip, AtSign, Palette, Minus,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { MERGE_TAGS, renderTemplate, getCustomerEmail, isValidEmail } from "./emailMergeTags";

const MAX_TOTAL_BYTES = 100 * 1024 * 1024; // 100MB

const COLORS = ["#FF4E32", "#08B531", "#335CF4", "#F59E0B", "#A855F7", "#111827"];

const formatSize = (b: number) =>
  b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: any[];
}

const ToolBtn = ({
  onClick, active, title, children, disabled,
}: { onClick: () => void; active?: boolean; title: string; children: React.ReactNode; disabled?: boolean }) => (
  <Button
    type="button"
    variant="ghost"
    size="sm"
    disabled={disabled}
    title={title}
    aria-label={title}
    onClick={onClick}
    className={cn("h-8 w-8 p-0", active && "bg-primary/15 text-primary")}
  >
    {children}
  </Button>
);

export const EmailComposerDialog = ({ open, onOpenChange, customers }: Props) => {
  const { toast } = useToast();
  const { user } = useAuth();

  const initialRecipients = useMemo(() => {
    const seen = new Set<string>();
    const list: { email: string; customer: any }[] = [];
    (customers || []).forEach((c) => {
      const email = getCustomerEmail(c).toLowerCase();
      if (!email || seen.has(email)) return;
      seen.add(email);
      list.push({ email, customer: c });
    });
    return list;
  }, [customers]);

  const skipped = (customers?.length || 0) - initialRecipients.length;

  const [recipients, setRecipients] = useState(initialRecipients);
  const [toInput, setToInput] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [showBcc, setShowBcc] = useState(false);
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("<p></p>");
  const [sourceMode, setSourceMode] = useState(false);
  const [sourceDraft, setSourceDraft] = useState("");
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inlineInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setRecipients(initialRecipients);
      setProgress(0);
      setPreviewIndex(null);
    }
  }, [open, initialRecipients]);

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
        Underline,
        TextStyle,
        Color,
        Image.configure({ HTMLAttributes: { style: "max-width:100%;height:auto;border-radius:8px;" } }),
        Link.configure({ openOnClick: false, autolink: true }),
        Placeholder.configure({ placeholder: "Write your message… type @ tags like @full_name to personalize" }),
      ],
      content: html,
      editorProps: { attributes: { class: "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[220px] p-4" } },
      onUpdate: ({ editor }) => setHtml(editor.getHTML()),
    },
    [open]
  );

  const totalBytes = files.reduce((s, f) => s + f.size, 0);

  const addFiles = useCallback(
    (incoming: File[]) => {
      if (!incoming.length) return;
      const next = [...files];
      let total = totalBytes;
      const rejected: string[] = [];
      incoming.forEach((f) => {
        if (total + f.size > MAX_TOTAL_BYTES) {
          rejected.push(f.name);
          return;
        }
        total += f.size;
        next.push(f);
      });
      setFiles(next);
      if (rejected.length) {
        toast({
          title: "Attachment limit reached",
          description: `${rejected.join(", ")} skipped — total must stay under 100MB.`,
          variant: "destructive",
        });
      }
    },
    [files, totalBytes, toast]
  );

  const uploadToStorage = useCallback(
    async (file: File) => {
      const uid = user?.id;
      if (!uid) throw new Error("Not authenticated");
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
      const { error } = await supabase.storage.from("email-attachments").upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
      if (error) throw error;
      return path;
    },
    [user?.id]
  );

  const insertInlineImage = useCallback(
    async (file: File) => {
      try {
        const path = await uploadToStorage(file);
        const { data, error } = await supabase.storage
          .from("email-attachments")
          .createSignedUrl(path, 60 * 60 * 24 * 365);
        if (error || !data?.signedUrl) throw error || new Error("Could not create link");
        editor?.chain().focus().setImage({ src: data.signedUrl, alt: file.name }).run();
      } catch (e: any) {
        toast({ title: "Image upload failed", description: e?.message || "Try again", variant: "destructive" });
      }
    },
    [editor, uploadToStorage, toast]
  );

  const addTypedRecipients = () => {
    const parts = toInput.split(/[,;\s]+/).map((p) => p.trim()).filter(Boolean);
    if (!parts.length) return;
    const invalid = parts.filter((p) => !isValidEmail(p));
    const valid = parts.filter(isValidEmail).map((e) => e.toLowerCase());
    if (valid.length) {
      setRecipients((prev) => {
        const seen = new Set(prev.map((r) => r.email));
        return [...prev, ...valid.filter((e) => !seen.has(e)).map((email) => ({ email, customer: null }))];
      });
    }
    setToInput("");
    if (invalid.length) {
      toast({ title: "Invalid addresses skipped", description: invalid.join(", "), variant: "destructive" });
    }
  };

  const insertTag = (token: string) => {
    editor?.chain().focus().insertContent(`@${token}`).run();
  };

  const toggleSource = () => {
    if (!sourceMode) {
      setSourceDraft(editor?.getHTML() || html);
      setSourceMode(true);
    } else {
      editor?.commands.setContent(sourceDraft, false);
      setHtml(sourceDraft);
      setSourceMode(false);
    }
  };

  const previewCustomer = previewIndex != null ? recipients[previewIndex]?.customer : null;

  const handleSend = async () => {
    if (!recipients.length) {
      toast({ title: "Add at least one recipient", variant: "destructive" });
      return;
    }
    if (!subject.trim()) {
      toast({ title: "Subject is required", variant: "destructive" });
      return;
    }
    const body = sourceMode ? sourceDraft : editor?.getHTML() || html;
    if (!body || body.replace(/<[^>]*>/g, "").trim().length === 0) {
      toast({ title: "Message is empty", variant: "destructive" });
      return;
    }

    setSending(true);
    setProgress(2);
    try {
      // Upload attachments once, shared by all recipients
      const uploaded: { path: string; filename: string; size: number; content_type: string }[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const path = await uploadToStorage(f);
        uploaded.push({ path, filename: f.name, size: f.size, content_type: f.type || "application/octet-stream" });
        setProgress(Math.round(((i + 1) / Math.max(files.length, 1)) * 25));
      }
      setProgress(30);

      const payload = {
        subject,
        html: body,
        cc: cc.split(/[,;\s]+/).map((s) => s.trim()).filter(isValidEmail),
        bcc: bcc.split(/[,;\s]+/).map((s) => s.trim()).filter(isValidEmail),
        reply_to: user?.email || undefined,
        attachments: uploaded,
        recipients: recipients.map((r) => ({
          email: r.email,
          subject: renderTemplate(subject, r.customer),
          html: renderTemplate(body, r.customer, { html: true }),
        })),
      };

      const { data, error } = await supabase.functions.invoke("send-crm-bulk-email", { body: payload });
      setProgress(100);
      if (error) throw error;

      const sent = data?.sent ?? 0;
      const failed = data?.failed ?? 0;
      toast({
        title: failed ? `Sent ${sent}, failed ${failed}` : `Sent ${sent} email${sent === 1 ? "" : "s"}`,
        description: failed
          ? (data?.results || []).filter((r: any) => !r.ok).map((r: any) => `${r.email}: ${r.error}`).join(" · ")
          : "Personalized emails delivered.",
        variant: failed ? "destructive" : undefined,
      });
      if (!failed) {
        onOpenChange(false);
        setFiles([]);
      }
    } catch (e: any) {
      toast({ title: "Sending failed", description: e?.message || "Unknown error", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !sending && onOpenChange(v)}>
      <DialogContent className="max-w-4xl w-[96vw] max-h-[92vh] min-w-0 p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 py-3 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Send className="h-4 w-4 text-primary" />
            Send email {recipients.length > 0 && <Badge variant="secondary">{recipients.length}</Badge>}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(92vh-8.5rem)]">
          <div className="p-5 space-y-4 min-w-0">
            {/* Recipients */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">To</Label>
                <div className="flex gap-3 text-xs">
                  <button type="button" className="text-primary hover:underline" onClick={() => setShowBcc((v) => !v)}>
                    {showBcc ? "Hide Bcc" : "Add Bcc"}
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 rounded-md border border-input bg-background p-2">
                {recipients.map((r, i) => (
                  <span key={r.email} className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
                    {r.email}
                    <button
                      type="button"
                      aria-label={`Remove ${r.email}`}
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
                  placeholder={recipients.length ? "Add another…" : "name@example.com"}
                  className="flex-1 min-w-[10rem] bg-transparent text-base md:text-sm outline-none"
                />
              </div>
              {skipped > 0 && (
                <p className="text-xs text-muted-foreground">
                  {skipped} selected customer{skipped === 1 ? "" : "s"} had no valid email and {skipped === 1 ? "was" : "were"} skipped.
                </p>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Cc</Label>
                <Input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="optional" className="text-base md:text-sm" />
              </div>
              {showBcc && (
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Bcc</Label>
                  <Input value={bcc} onChange={(e) => setBcc(e.target.value)} placeholder="optional" className="text-base md:text-sm" />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Subject</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Hello @full_name…"
                className="text-base md:text-sm"
              />
            </div>

            {/* Editor */}
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/40 px-1.5 py-1">
                <ToolBtn title="Bold" active={editor?.isActive("bold")} onClick={() => editor?.chain().focus().toggleBold().run()}><Bold className="h-4 w-4" /></ToolBtn>
                <ToolBtn title="Italic" active={editor?.isActive("italic")} onClick={() => editor?.chain().focus().toggleItalic().run()}><Italic className="h-4 w-4" /></ToolBtn>
                <ToolBtn title="Underline" active={editor?.isActive("underline")} onClick={() => editor?.chain().focus().toggleUnderline().run()}><UnderlineIcon className="h-4 w-4" /></ToolBtn>
                <ToolBtn title="Strike" active={editor?.isActive("strike")} onClick={() => editor?.chain().focus().toggleStrike().run()}><Strikethrough className="h-4 w-4" /></ToolBtn>
                <span className="mx-1 h-5 w-px bg-border" />
                <ToolBtn title="Heading 1" active={editor?.isActive("heading", { level: 1 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 className="h-4 w-4" /></ToolBtn>
                <ToolBtn title="Heading 2" active={editor?.isActive("heading", { level: 2 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="h-4 w-4" /></ToolBtn>
                <ToolBtn title="Bullet list" active={editor?.isActive("bulletList")} onClick={() => editor?.chain().focus().toggleBulletList().run()}><List className="h-4 w-4" /></ToolBtn>
                <ToolBtn title="Numbered list" active={editor?.isActive("orderedList")} onClick={() => editor?.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></ToolBtn>
                <ToolBtn title="Quote" active={editor?.isActive("blockquote")} onClick={() => editor?.chain().focus().toggleBlockquote().run()}><Quote className="h-4 w-4" /></ToolBtn>
                <ToolBtn title="Divider" onClick={() => editor?.chain().focus().setHorizontalRule().run()}><Minus className="h-4 w-4" /></ToolBtn>
                <span className="mx-1 h-5 w-px bg-border" />
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="ghost" size="sm" title="Text color" className="h-8 w-8 p-0"><Palette className="h-4 w-4" /></Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-2 z-[15000]">
                    <div className="flex gap-1.5">
                      {COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          aria-label={`Color ${c}`}
                          style={{ backgroundColor: c }}
                          className="h-6 w-6 rounded-full border border-border"
                          onClick={() => editor?.chain().focus().setColor(c).run()}
                        />
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                <ToolBtn
                  title="Link"
                  active={editor?.isActive("link")}
                  onClick={() => {
                    const url = window.prompt("Link URL", editor?.getAttributes("link")?.href || "https://");
                    if (url === null) return;
                    if (!url) editor?.chain().focus().unsetLink().run();
                    else editor?.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
                  }}
                >
                  <LinkIcon className="h-4 w-4" />
                </ToolBtn>
                <ToolBtn title="Insert image" onClick={() => inlineInputRef.current?.click()}><ImageIcon className="h-4 w-4" /></ToolBtn>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="ghost" size="sm" title="Personalization tag" className="h-8 w-8 p-0"><AtSign className="h-4 w-4" /></Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-1 z-[15000]">
                    {MERGE_TAGS.map((tag) => (
                      <button
                        key={tag.token}
                        type="button"
                        onClick={() => insertTag(tag.token)}
                        className="flex w-full items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-accent"
                      >
                        <span>{tag.label}</span>
                        <span className="text-xs text-muted-foreground">@{tag.token}</span>
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
                <span className="mx-1 h-5 w-px bg-border" />
                <ToolBtn title="HTML source" active={sourceMode} onClick={toggleSource}><Code2 className="h-4 w-4" /></ToolBtn>
                <ToolBtn
                  title="Preview"
                  active={previewIndex != null}
                  onClick={() => setPreviewIndex((p) => (p == null ? 0 : null))}
                >
                  <Eye className="h-4 w-4" />
                </ToolBtn>
                <span className="ml-auto flex items-center">
                  <ToolBtn title="Undo" onClick={() => editor?.chain().focus().undo().run()}><Undo2 className="h-4 w-4" /></ToolBtn>
                  <ToolBtn title="Redo" onClick={() => editor?.chain().focus().redo().run()}><Redo2 className="h-4 w-4" /></ToolBtn>
                </span>
              </div>

              {previewIndex != null ? (
                <div>
                  <div className="flex items-center gap-2 border-b border-border bg-background px-3 py-2 text-xs">
                    <span className="text-muted-foreground">Preview for</span>
                    <select
                      value={previewIndex}
                      onChange={(e) => setPreviewIndex(Number(e.target.value))}
                      className="rounded border border-input bg-background px-2 py-1"
                    >
                      {recipients.map((r, i) => (
                        <option key={r.email} value={i}>{r.email}</option>
                      ))}
                    </select>
                  </div>
                  <div className="p-4 space-y-2">
                    <p className="text-sm font-semibold">{renderTemplate(subject, previewCustomer) || "(no subject)"}</p>
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{
                        __html: renderTemplate(sourceMode ? sourceDraft : html, previewCustomer, { html: true }),
                      }}
                    />
                  </div>
                </div>
              ) : sourceMode ? (
                <textarea
                  value={sourceDraft}
                  onChange={(e) => setSourceDraft(e.target.value)}
                  spellCheck={false}
                  className="w-full min-h-[240px] bg-background p-4 font-mono text-sm outline-none"
                />
              ) : (
                <div
                  onPaste={(e) => {
                    const items = Array.from(e.clipboardData?.items || []);
                    const imgItem = items.find((it) => it.kind === "file" && it.type.startsWith("image/"));
                    if (imgItem) {
                      const f = imgItem.getAsFile();
                      if (f) {
                        e.preventDefault();
                        insertInlineImage(f);
                      }
                    }
                  }}
                >
                  <EditorContent editor={editor} />
                </div>
              )}
            </div>

            {/* Attachments */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <Paperclip className="h-4 w-4 text-primary" /> Attachments
                </span>
                <span className="text-xs text-muted-foreground">{formatSize(totalBytes)} / 100 MB</span>
              </div>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  addFiles(Array.from(e.dataTransfer.files || []));
                }}
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer rounded-lg border-2 border-dashed border-border px-4 py-4 text-center text-sm text-muted-foreground hover:border-primary/50 hover:bg-accent/40"
              >
                Drop files here or click to browse — images, videos, documents, any type
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  addFiles(Array.from(e.target.files || []));
                  e.target.value = "";
                }}
              />
              <input
                ref={inlineInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) insertInlineImage(f);
                  e.target.value = "";
                }}
              />
              {files.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {files.map((f, i) => (
                    <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-sm">
                      <span className="truncate max-w-[12rem]">{f.name}</span>
                      <span className="text-xs text-muted-foreground">{formatSize(f.size)}</span>
                      <button
                        type="button"
                        aria-label={`Remove ${f.name}`}
                        onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                        className="rounded-full p-0.5 hover:bg-destructive hover:text-destructive-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {totalBytes > 20 * 1024 * 1024 && (
                <p className="text-xs text-muted-foreground">
                  Files over the 20 MB email limit are delivered as secure download links inside the email.
                </p>
              )}
            </div>

            {sending && <Progress value={progress} className="h-2" />}
          </div>
        </ScrollArea>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={sending}>Cancel</Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Send {recipients.length > 0 ? `(${recipients.length})` : ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
