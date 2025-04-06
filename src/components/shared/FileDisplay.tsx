
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, Trash2, File, Image, ExternalLink } from "lucide-react";
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

  // Return to the original file display style with a list of file cards
  return (
    <div className="space-y-3">
      {files.map((file) => (
        <Card key={file.id} className="p-4 relative overflow-hidden">
          <div className="flex items-center">
            <div className="flex-shrink-0 w-12 h-12 bg-muted rounded flex items-center justify-center mr-3">
              {isImageFile(file.content_type) ? (
                <Image className="w-7 h-7 text-muted-foreground" />
              ) : (
                <File className="w-7 h-7 text-muted-foreground" />
              )}
            </div>
            <div className="overflow-hidden">
              <p className="font-medium text-sm truncate">{file.filename || file.id}</p>
              <p className="text-xs text-muted-foreground truncate">
                {file.content_type || "Unknown file type"}
              </p>
            </div>
            <div className="ml-auto flex space-x-1">
              <Button
                variant="ghost"
                size="sm"
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
                  variant="ghost"
                  size="sm"
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
