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

// NEW: utils to format sizes (optional nice touch)
const formatSize = (n?: number) =>
  typeof n === 'number' ? `${(n / (1024 * 1024)).toFixed(1)} MB` : '';

export function MessageAttachments({ attachments }: { attachments: Att[] }) {
  if (!attachments?.length) return null;

  // robust download (blob) — unchanged, just shared blob helper below
  const downloadFile = async (a: Att) => {
    const { data, error } = await supabase.storage.from('chat_attachments').download(a.file_path);
    if (error || !data) return;

    // ensure correct type for the downloaded blob
    const blob =
      data.type && data.type !== 'application/octet-stream'
        ? data
        : new Blob([await data.arrayBuffer()], { type: a.content_type || 'application/octet-stream' });

    const blobUrl = URL.createObjectURL(blob);
    const aTag = document.createElement('a');
    aTag.href = blobUrl;
    aTag.download = a.filename || 'download';
    document.body.appendChild(aTag);
    aTag.click();
    aTag.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  };

  // OPEN in new tab with a correctly typed Blob (PDFs render inline)
  const openDoc = async (a: Att) => {
    const { data, error } = await supabase.storage.from('chat_attachments').download(a.file_path);
    if (error || !data) return;

    const blob =
      data.type && data.type !== 'application/octet-stream'
        ? data
        : new Blob([await data.arrayBuffer()], { type: a.content_type || 'application/octet-stream' });

    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, '_blank', 'noopener,noreferrer');
    // let the new tab live for a bit before revoking
    setTimeout(() => URL.revokeObjectURL(blobUrl), 120_000);
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
                {/* show image proportionally (no forced aspect) */}
                <img
                  src={a.object_url || href}
                  alt={a.filename}
                  className="w-full h-auto max-h-80 object-contain bg-background"
                  loading="lazy"
                />
              </a>
            ) : (
              <button type="button" onClick={() => openDoc(a)} className="w-full text-left">
                <div className="w-full h-28 md:h-32 px-4 flex items-center gap-3 bg-background">
                  {iconFor(a.content_type, a.filename)}
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{a.filename}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {(a.content_type || 'file').toUpperCase()} {formatSize(a.size)}
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
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"><path d="M14 3h7v7" stroke="currentColor" strokeWidth="2"/><path d="M10 14L21 3" stroke="currentColor" strokeWidth="2"/><path d="M21 14v7h-7" stroke="currentColor" strokeWidth="2"/><path d="M3 10l11 11" stroke="currentColor" strokeWidth="2"/></svg>
                    Open
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => openDoc(a)}
                    className="inline-flex items-center gap-1 hover:underline"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"><path d="M14 3h7v7" stroke="currentColor" strokeWidth="2"/><path d="M10 14L21 3" stroke="currentColor" strokeWidth="2"/><path d="M21 14v7h-7" stroke="currentColor" strokeWidth="2"/><path d="M3 10l11 11" stroke="currentColor" strokeWidth="2"/></svg>
                    Open
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => downloadFile(a)}
                  className="inline-flex items-center gap-1 hover:underline"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"><path d="M12 3v12" stroke="currentColor" strokeWidth="2"/><path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2"/><path d="M5 21h14" stroke="currentColor" strokeWidth="2"/></svg>
                  Download
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}