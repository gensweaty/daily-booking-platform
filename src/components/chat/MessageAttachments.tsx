import { supabase } from '@/integrations/supabase/client';
import { FileText, FileSpreadsheet, FileIcon, Image as ImageIcon } from 'lucide-react';

type Att = {
  id?: string;
  filename: string;
  file_path: string;
  content_type?: string;
  size?: number;
  /** optional, passed by optimistic UI */
  public_url?: string;
  /** optional, for very first paint */
  object_url?: string;
};

const getIcon = (ct?: string, name?: string) => {
  if (ct?.startsWith('image/')) return <ImageIcon className="h-4 w-4" />;
  if (ct === 'application/pdf') return <FileText className="h-4 w-4" />;
  if (ct?.includes('spreadsheet') || /\.(xlsx|xls|csv)$/i.test(name ?? '')) return <FileSpreadsheet className="h-4 w-4" />;
  if (ct?.includes('word') || /\.(docx?|rtf)$/i.test(name ?? '')) return <FileText className="h-4 w-4" />;
  return <FileIcon className="h-4 w-4" />;
};

const urlFor = (a: Att) => {
  if (a.public_url) return a.public_url;
  const { data } = supabase.storage.from('chat_attachments').getPublicUrl(a.file_path);
  return data.publicUrl;
};

export function MessageAttachments({ attachments }: { attachments: Att[] }) {
  if (!attachments?.length) return null;

  return (
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      {attachments.map((a, i) => {
        const isImage = a.content_type?.startsWith('image/');
        const href = urlFor(a);

        return (
          <a
            key={a.id ?? `${a.file_path}-${i}`}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="group rounded-lg border bg-muted/30 overflow-hidden hover:bg-muted/50 transition"
            title={a.filename}
          >
            {/* Long, wide thumbnail like your 2nd screenshot */}
            <div className="aspect-[3/1] w-full bg-background flex items-center justify-center overflow-hidden">
              {isImage ? (
                <img
                  src={a.object_url || href}
                  alt={a.filename}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex items-center gap-2 text-sm text-foreground/80">
                  {getIcon(a.content_type, a.filename)}
                  <span className="truncate max-w-[75%]">{a.filename}</span>
                </div>
              )}
            </div>
            {/* Footer row */}
            <div className="px-3 py-2 text-xs flex items-center justify-between">
              <span className="truncate">{a.filename}</span>
              <span className="text-muted-foreground">
                {a.content_type?.split('/')[1]?.toUpperCase() || 'FILE'}
              </span>
            </div>
          </a>
        );
      })}
    </div>
  );
}