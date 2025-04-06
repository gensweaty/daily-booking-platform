
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, Trash2, File, Image } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface FileDisplayProps {
  files: {
    id: string;
    filename: string;
    content_type?: string;
  }[];
  bucketName?: string;
  source?: string;
  allowDelete?: boolean;
  onFileDeleted?: (fileId: string) => void;
}

export const FileDisplay = ({ 
  files, 
  bucketName = "customer_attachments", 
  source = "customer_attachments",
  allowDelete = false,
  onFileDeleted 
}: FileDisplayProps) => {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { toast } = useToast();

  if (!files || files.length === 0) {
    return null;
  }

  const isImageFile = (contentType?: string) => {
    return contentType?.startsWith('image/');
  };

  const handleDownload = async (fileId: string, filename: string) => {
    try {
      setDownloading(fileId);
      console.log("Downloading file:", { fileId, filename, source });
      
      // Determine storage bucket based on source or bucketName
      const storageBucket = source === "booking_attachments" ? "booking_attachments" : 
                           (source === "event_attachments" ? "event_attachments" : bucketName);
      
      console.log("Using storage bucket:", storageBucket);
      
      const { data, error } = await supabase.storage
        .from(storageBucket)
        .download(fileId);

      if (error) {
        console.error("Error downloading file:", error);
        toast({
          title: "Download Error",
          description: `Failed to download file: ${error.message}`,
          variant: "destructive",
        });
        return;
      }

      if (!data) {
        toast({
          title: "Download Error",
          description: "File not found",
          variant: "destructive",
        });
        return;
      }

      // Create blob URL and trigger download
      const blob = new Blob([data], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || "download";
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download Success",
        description: "File downloaded successfully",
      });
    } catch (error: any) {
      console.error("Exception downloading file:", error);
      toast({
        title: "Download Error",
        description: error.message || "Failed to download file",
        variant: "destructive",
      });
    } finally {
      setDownloading(null);
    }
  };

  const handleDelete = async (fileId: string) => {
    if (!allowDelete || !onFileDeleted) return;
    
    try {
      setDeleting(fileId);
      onFileDeleted(fileId);
    } catch (error: any) {
      console.error("Error deleting file:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete file",
        variant: "destructive",
      });
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {files.map((file) => (
        <Card key={file.id} className="p-3 flex items-center justify-between overflow-hidden">
          <div className="flex items-center gap-2 w-full">
            <div className="flex-shrink-0 w-10 h-10 bg-muted rounded flex items-center justify-center">
              {isImageFile(file.content_type) ? (
                <Image className="w-6 h-6 text-muted-foreground" />
              ) : (
                <File className="w-6 h-6 text-muted-foreground" />
              )}
            </div>
            <div className="truncate text-sm flex-1">
              {file.filename || file.id}
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleDownload(file.id, file.filename)}
                disabled={downloading === file.id}
                className="h-8 w-8"
              >
                {downloading === file.id ? (
                  <span className="animate-spin">...</span>
                ) : (
                  <Download className="w-4 h-4" />
                )}
              </Button>
              {allowDelete && onFileDeleted && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleDelete(file.id)}
                  disabled={deleting === file.id}
                  className="h-8 w-8"
                >
                  {deleting === file.id ? (
                    <span className="animate-spin">...</span>
                  ) : (
                    <Trash2 className="w-4 h-4 text-destructive" />
                  )}
                </Button>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};
