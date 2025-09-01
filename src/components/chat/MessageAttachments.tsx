import { supabase } from '@/integrations/supabase/client';
import { FileText, FileSpreadsheet, FileIcon, Image as ImageIcon, Download, ExternalLink } from 'lucide-react';

type Att = {
  id?: string;
  filename: string;
  file_path: string;
  content_type?: string;
  size?: number;
  public_url?: string;  // (optimistic)
  object_url?: string;  // (optimistic)
};

const iconFor = (ct?: string, name?: string) => {
  if (ct?.startsWith('image/')) return <ImageIcon className="h-4 w-4" />;
  if (ct === 'application/pdf') return <FileText className="h-4 w-4" />;
  if (ct?.includes('spreadsheet') || /\.(xlsx|xls|csv)$/i.test(name ?? '')) return <FileSpreadsheet className="h-4 w-4" />;
  if (ct?.includes('word') || /\.(docx?|rtf)$/i.test(name ?? '')) return <FileText className="h-4 w-4" />;
  return <FileIcon className="h-4 w-4" />;
};

const publicUrlFor = (a: Att) => a.public_url ?? supabase.storage.from('chat_attachments').getPublicUrl(a.file_path).data.publicUrl;

export function MessageAttachments({ attachments }: { attachments: Att[] }) {
  if (!attachments?.length) return null;

  // helper: robust download that avoids ad-blocked public URL navigations
  const downloadFile = async (a: Att) => {
    const { data, error } = await supabase.storage.from('chat_attachments').download(a.file_path);
    if (error || !data) return;
    const blobUrl = URL.createObjectURL(data);
    const aTag = document.createElement('a');
    aTag.href = blobUrl;
    aTag.download = a.filename || 'download';
    document.body.appendChild(aTag);
    aTag.click();
    aTag.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  };

  // helper: open non-image docs in a new tab using blob (also bypasses blockers)
  const openDoc = async (a: Att) => {
    const { data, error } = await supabase.storage.from('chat_attachments').download(a.file_path);
    if (error || !data) return;
    const blobUrl = URL.createObjectURL(data);
    window.open(blobUrl, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000); // give the tab time
  };

  return (
    <div className="mt-2 grid gap-3 sm:grid-cols-2">
      {attachments.map((a, i) => {
        const isImage = a.content_type?.startsWith('image/');
        const href = publicUrlFor(a);

        return (
          <div
            key={a.id ?? `${a.file_path}-${i}`}
            className="group rounded-lg border bg-muted/30 overflow-hidden hover:bg-muted/50 transition"
            title={a.filename}
          >
            {/* Media */}
            {isImage ? (
              <a href={href} target="_blank" rel="noopener noreferrer" className="block">
                {/* Natural aspect ratio, long & wide, capped height so timeline stays neat */}
                <img
                  src={a.object_url || href}
                  alt={a.filename}
                  className="w-full h-auto max-h-72 object-contain bg-background"
                  loading="lazy"
                />
              </a>
            ) : (
              <button
                type="button"
                onClick={() => openDoc(a)}
                className="w-full text-left"
              >
                <div className="w-full h-28 md:h-32 px-4 flex items-center gap-3 bg-background">
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

            {/* Footer actions */}
            <div className="px-3 py-2 text-xs flex items-center justify-between">
              <span className="truncate">{a.filename}</span>
              <div className="flex items-center gap-2">
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
          </div>
        );
      })}
    </div>
  );
}