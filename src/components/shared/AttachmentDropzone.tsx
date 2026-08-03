import { useCallback, useEffect, useRef, useState } from "react";
import { Paperclip, X, FileText, ImageIcon, Music, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB (unchanged)
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const ALLOWED_DOC_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
];
const ALLOWED_AUDIO_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/webm",
  "audio/wav",
  "audio/x-wav",
  "audio/m4a",
  "audio/x-m4a",
  "audio/ogg",
  "video/webm",
];

export const validateAttachment = (file: File): string | null => {
  const ok =
    ALLOWED_IMAGE_TYPES.includes(file.type) ||
    ALLOWED_DOC_TYPES.includes(file.type) ||
    ALLOWED_AUDIO_TYPES.includes(file.type);
  if (!ok) {
    return `"${file.name}" is not a supported file type (images, documents or audio).`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return `"${file.name}" exceeds the 5MB limit.`;
  }
  return null;
};

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const iconFor = (file: File) => {
  if (file.type.startsWith("image/")) return ImageIcon;
  if (file.type.startsWith("audio/") || file.type === "video/webm") return Music;
  return FileText;
};

interface AttachmentDropzoneProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  error?: string;
  setError?: (error: string) => void;
  /** Element that paste events are captured from (defaults to document). */
  pasteTargetRef?: React.RefObject<HTMLElement>;
  disabled?: boolean;
}

export const AttachmentDropzone = ({
  files,
  onFilesChange,
  error = "",
  setError,
  pasteTargetRef,
  disabled,
}: AttachmentDropzoneProps) => {
  const { language } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const filesRef = useRef(files);
  filesRef.current = files;

  const addFiles = useCallback(
    (incoming: File[]) => {
      if (!incoming.length) return;
      const accepted: File[] = [];
      const errors: string[] = [];
      incoming.forEach((file) => {
        const err = validateAttachment(file);
        if (err) {
          errors.push(err);
          return;
        }
        const duplicate = filesRef.current.some(
          (f) => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified
        );
        if (!duplicate) accepted.push(file);
      });
      setError?.(errors.join(" "));
      if (accepted.length) onFilesChange([...filesRef.current, ...accepted]);
    },
    [onFilesChange, setError]
  );

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
    setError?.("");
  };

  // Paste anywhere inside the dialog/form
  useEffect(() => {
    if (disabled) return;
    const target: HTMLElement | Document = pasteTargetRef?.current || document;

    const handlePaste = (event: Event) => {
      const e = event as ClipboardEvent;
      const items = e.clipboardData?.items;
      if (!items) return;
      const pasted: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind !== "file") continue;
        const file = item.getAsFile();
        if (!file) continue;
        if (!file.name || file.name === "image.png" || file.name === "blob") {
          const ext = (file.type.split("/")[1] || "png").replace("jpeg", "jpg");
          pasted.push(new File([file], `pasted-image-${Date.now()}.${ext}`, { type: file.type }));
        } else {
          pasted.push(file);
        }
      }
      if (pasted.length) {
        e.preventDefault();
        addFiles(pasted);
      }
    };

    target.addEventListener("paste", handlePaste as EventListener);
    return () => target.removeEventListener("paste", handlePaste as EventListener);
  }, [addFiles, pasteTargetRef, disabled]);

  const labels =
    language === "ka"
      ? {
          drop: "ჩააგდე ან ჩასვი ფაილები აქ",
          hint: "სურათები, დოკუმენტები, აუდიო — მაქს. 5MB",
          browse: "ფაილის არჩევა",
          attachments: "დანართები",
        }
      : language === "es"
      ? {
          drop: "Arrastra o pega archivos aquí",
          hint: "Imágenes, documentos, audio — máx. 5MB",
          browse: "Elegir archivo",
          attachments: "Adjuntos",
        }
      : {
          drop: "Drop files here, or paste with Ctrl/⌘+V",
          hint: "Images, documents, audio — max 5MB each",
          browse: "Choose files",
          attachments: "Attachments",
        };

  return (
    <div className="space-y-3 min-w-0">
      <div className="flex items-center gap-2">
        <Paperclip className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">{labels.attachments}</span>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (disabled) return;
          addFiles(Array.from(e.dataTransfer.files || []));
        }}
        onClick={() => !disabled && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-5 text-center cursor-pointer transition-colors",
          isDragging
            ? "border-primary bg-primary/10"
            : "border-border bg-background hover:border-primary/50 hover:bg-accent/40",
          disabled && "opacity-60 pointer-events-none"
        )}
      >
        <UploadCloud className="h-5 w-5 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">{labels.drop}</p>
        <p className="text-xs text-muted-foreground">{labels.hint}</p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-1 h-8"
          onClick={(e) => {
            e.stopPropagation();
            inputRef.current?.click();
          }}
        >
          {labels.browse}
        </Button>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        accept={[...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOC_TYPES, ...ALLOWED_AUDIO_TYPES].join(",")}
        onChange={(e) => {
          addFiles(Array.from(e.target.files || []));
          e.target.value = "";
        }}
      />

      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {files.map((file, index) => {
            const Icon = iconFor(file);
            return (
              <li
                key={`${file.name}-${file.size}-${index}`}
                className="flex max-w-full items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-sm text-card-foreground"
              >
                <Icon className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate max-w-[10rem] sm:max-w-[16rem]">{file.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">{formatSize(file.size)}</span>
                <button
                  type="button"
                  aria-label={`Remove ${file.name}`}
                  onClick={() => removeFile(index)}
                  className="rounded-full p-0.5 text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
};
