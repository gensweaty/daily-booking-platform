import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FileText, FileSpreadsheet, FileIcon, Image as ImageIcon, Download, ExternalLink, Presentation } from 'lucide-react';
import { Dialog, DialogContent, DialogOverlay, DialogPortal } from '@/components/ui/dialog';

type Att = {
  id?: string;
  filename: string;
  file_path: string;
  content_type?: string;
  size?: number;
  public_url?: string;
  object_url?: string;
};

const iconFor = (ct?: string, name?: string) => {
  const n = (name || '').toLowerCase();
  if (ct?.startsWith('image/')) return <ImageIcon className="h-4 w-4" />;
  if (ct === 'application/pdf' || n.endsWith('.pdf')) return <FileText className="h-4 w-4" />;
  if (ct?.includes('spreadsheet') || n.endsWith('.xlsx') || n.endsWith('.xls') || n.endsWith('.csv')) return <FileSpreadsheet className="h-4 w-4" />;
  if (ct?.includes('presentation') || n.endsWith('.ppt') || n.endsWith('.pptx')) return <Presentation className="h-4 w-4" />;
  if (ct?.includes('word') || n.endsWith('.doc') || n.endsWith('.docx') || n.endsWith('.rtf')) return <FileText className="h-4 w-4" />;
  return <FileIcon className="h-4 w-4" />;
};

const publicUrlFor = (a: Att) =>
  a.public_url ?? supabase.storage.from('chat_attachments').getPublicUrl(a.file_path).data.publicUrl;

// robust "Open in new tab" using a clickable anchor (avoids blocked window.open)
const openBlobInNewTab = (blob: Blob) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // keep URL alive a bit so the viewer loads
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

export function MessageAttachments({ attachments }: { attachments: Att[] }) {
  if (!attachments?.length) return null;

  // local preview state for modal popup
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  // 🔧 FIX: Track loading state for attachments
  const [loadingAttachments, setLoadingAttachments] = useState<Set<string>>(new Set());

  const downloadFile = async (a: Att) => {
    const { data, error } = await supabase.storage.from('chat_attachments').download(a.file_path);
    if (error || !data) return;
    const blobUrl = URL.createObjectURL(data);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = a.filename || 'download';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  };

  const openDoc = async (a: Att) => {
    const { data } = await supabase.storage.from('chat_attachments').download(a.file_path);
    if (!data) return;
    const url = URL.createObjectURL(data);
    // open in new tab (anchor avoids popup blockers)
    const aTag = document.createElement('a');
    aTag.href = url;
    aTag.target = '_blank';
    aTag.rel = 'noopener';
    document.body.appendChild(aTag);
    aTag.click();
    aTag.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  return (
    <>
      <div className="mt-2 grid gap-3">
        {attachments.map((a, i) => {
          const isImage = a.content_type?.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(a.filename);
          const href = publicUrlFor(a);

          return (
            <div
              key={a.id ?? `${a.file_path}-${i}`}
              // ~10% wider than the original compact card, not huge
              className="group rounded-lg border bg-muted/30 overflow-hidden hover:bg-muted/50 transition w-fit min-w-[288px] max-w-[342px]"
              title={a.filename}
            >
              {/* Media */}
              {isImage ? (
                // CLICK = popup on the same page
                 <button
                   type="button"
                   onClick={() => setPreviewSrc(a.object_url || href)}
                   className="block w-full"
                 >
                   <img
                     src={a.object_url || href}
                     alt={a.filename}
                     // modest height; no giant images in the timeline
                     className="w-full h-auto max-h-64 object-contain bg-background"
                     loading="lazy"
                     onError={(e) => {
                       // 🔧 FIX: Fallback for broken image URLs
                       const target = e.target as HTMLImageElement;
                       console.log('🖼️ Image load failed, trying fallback for:', a.filename);
                       if (!target.src.includes('retry=1')) {
                         target.src = `${publicUrlFor(a)}?retry=1&t=${Date.now()}`;
                       }
                     }}
                   />
                 </button>
              ) : (
                <button type="button" onClick={() => openDoc(a)} className="w-full text-left">
                  <div className="w-full h-28 px-4 flex items-center gap-3 bg-background">
                    {iconFor(a.content_type, a.filename)}
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{a.filename}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {(a.content_type || 'file').toUpperCase()}
                      </div>
                    </div>
                  </div>
                </button>
              )}

              {/* Action row on the LEFT */}
              <div className="px-3 py-2 text-xs flex items-center justify-start gap-3">
                {/* Open = new tab */}
                {isImage ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Open
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => openDoc(a)}
                    className="inline-flex items-center gap-1 hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Open
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => downloadFile(a)}
                  className="inline-flex items-center gap-1 hover:underline"
                >
                  <Download className="h-3.5 w-3.5" /> Download
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Image preview modal with high z-index */}
      <Dialog open={!!previewSrc} onOpenChange={() => setPreviewSrc(null)}>
        <DialogPortal>
          <DialogOverlay className="fixed inset-0 z-[10050] bg-black/70" />
          <DialogContent className="fixed left-1/2 top-1/2 z-[10060] -translate-x-1/2 -translate-y-1/2 w-[min(96vw,1100px)] max-h-[92vh] p-0 overflow-hidden rounded-xl bg-background shadow-2xl">
            {previewSrc && (
              <img
                src={previewSrc}
                alt="Preview"
                className="w-full h-auto max-h-[92vh] object-contain"
              />
            )}
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </>
  );
}
