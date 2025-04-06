
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Trash2, Download, FileIcon, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

export interface FileDisplayProps {
  files: Array<{
    id: string;
    filename: string;
    content_type?: string;
  }>;
  bucketName: string;
  allowDelete?: boolean;
  onFileDeleted?: (fileId: string) => void;
}

export const FileDisplay = ({
  files,
  bucketName,
  allowDelete = false,
  onFileDeleted,
}: FileDisplayProps) => {
  const [isDownloading, setIsDownloading] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const { toast } = useToast();

  if (!files.length) {
    return <p className="text-sm text-muted-foreground italic">No files attached</p>;
  }

  const handleDownload = async (fileId: string, filename: string) => {
    try {
      setIsDownloading(fileId);
      const { data, error } = await supabase.storage
        .from(bucketName)
        .download(fileId);

      if (error) {
        throw error;
      }

      const url = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({
        title: "Download failed",
        description: error.message || "File could not be downloaded",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(null);
    }
  };

  const handleDelete = async (fileId: string) => {
    try {
      setIsDeleting(fileId);
      const { error } = await supabase.storage.from(bucketName).remove([fileId]);

      if (error) {
        throw error;
      }

      // Call the onFileDeleted callback
      if (onFileDeleted) {
        onFileDeleted(fileId);
      }

      toast({
        title: "File deleted",
        description: "The file has been removed successfully",
      });
    } catch (error: any) {
      toast({
        title: "Deletion failed",
        description: error.message || "File could not be deleted",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(null);
    }
  };

  const openFileInNewTab = async (fileId: string) => {
    try {
      const { data: urlData, error } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(fileId, 3600); // 1 hour expiry

      if (error) {
        throw error;
      }

      if (urlData?.signedUrl) {
        window.open(urlData.signedUrl, '_blank');
      }
    } catch (error: any) {
      toast({
        title: "Error opening file",
        description: error.message || "File could not be opened",
        variant: "destructive",
      });
    }
  };

  const isImageFile = (contentType?: string) => {
    return contentType?.startsWith('image/');
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {files.map((file) => (
        <div
          key={file.id}
          className="flex flex-col items-center"
        >
          <div 
            className="relative w-24 h-24 rounded-md overflow-hidden border border-muted mb-1 cursor-pointer"
            onClick={() => openFileInNewTab(file.id)}
          >
            {isImageFile(file.content_type) ? (
              <img 
                src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/${bucketName}/${file.id}`}
                alt={file.filename}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = '/placeholder.svg';
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-muted/30">
                <FileIcon className="h-8 w-8 opacity-70" />
              </div>
            )}
          </div>
          
          <div className="text-xs truncate max-w-[96px] text-center mb-1">{file.filename}</div>
          
          <div className="flex gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => handleDownload(file.id, file.filename)}
              disabled={isDownloading === file.id}
              title="Download"
            >
              {isDownloading === file.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Download className="h-3 w-3" />
              )}
            </Button>
            
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => openFileInNewTab(file.id)}
              title="Open"
            >
              <ExternalLink className="h-3 w-3" />
            </Button>
            
            {allowDelete && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(file.id);
                }}
                disabled={isDeleting === file.id}
                title="Delete"
              >
                {isDeleting === file.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3" />
                )}
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
