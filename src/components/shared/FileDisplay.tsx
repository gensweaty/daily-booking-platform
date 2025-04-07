
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { Download, Trash2, FileIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";

interface FileDisplayProps {
  files: any[];
  bucketName: string;
  allowDelete?: boolean;
  onFileDeleted?: (fileId: string) => void;
  parentId?: string;
  parentType?: string;
}

export const FileDisplay = ({ 
  files, 
  bucketName, 
  allowDelete = false, 
  onFileDeleted,
  parentId,
  parentType
}: FileDisplayProps) => {
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const [loadedFiles, setLoadedFiles] = useState<any[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  // Load and display files when component mounts or when files prop changes
  useEffect(() => {
    if (files && files.length > 0) {
      console.log("FileDisplay received files:", files);
      setLoadedFiles(files);
    } else {
      setLoadedFiles([]);
    }
  }, [files]);

  const getFileExtension = (filename: string): string => {
    return filename.split('.').pop()?.toLowerCase() || '';
  };
  
  const isImage = (filename: string): boolean => {
    const ext = getFileExtension(filename);
    return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
  };

  const getFileIcon = (filename: string) => {
    return <FileIcon className="h-5 w-5" />;
  };

  const handleDownload = async (filePath: string, fileName: string) => {
    try {
      console.log("Downloading file:", filePath, fileName);
      const { data, error } = await supabase.storage
        .from(bucketName)
        .download(filePath);

      if (error) {
        console.error("Download error:", error);
        toast({
          title: t("common.error"),
          description: t("common.downloadError"),
          variant: "destructive",
        });
        throw error;
      }

      // Create a URL for the blob and trigger download
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: t("common.success"),
        description: t("common.downloadStarted"),
      });
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };

  const handleDelete = async (fileId: string, filePath: string) => {
    try {
      setDeletingFileId(fileId);
      console.log("Deleting file:", fileId, filePath, "Parent type:", parentType);
      
      // First delete the file from storage
      const { error: storageError } = await supabase.storage
        .from(bucketName)
        .remove([filePath]);

      if (storageError) {
        console.error('Error deleting file from storage:', storageError);
        // Continue with deleting the database record even if storage deletion fails
      }
      
      // Determine the table to delete from based on parentType
      let tableName = 'event_files';
      
      if (parentType === 'customer') {
        tableName = 'customer_files_new';
      } else if (filePath.includes('task')) {
        tableName = 'files'; // For task files
      }
      
      console.log(`Deleting file record from ${tableName} table with ID:`, fileId);
      
      // Delete from the appropriate database table
      const { error: dbError } = await supabase
        .from(tableName)
        .delete()
        .eq('id', fileId);
        
      if (dbError) {
        console.error(`Error deleting file record from ${tableName}:`, dbError);
        throw dbError;
      }
      
      // Update local state to remove the deleted file
      setLoadedFiles(prev => prev.filter(file => file.id !== fileId));
      
      // Notify parent component
      if (onFileDeleted) {
        onFileDeleted(fileId);
      }
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['files'] });
      queryClient.invalidateQueries({ queryKey: ['taskFiles'] });
      queryClient.invalidateQueries({ queryKey: ['eventFiles'] });
      queryClient.invalidateQueries({ queryKey: ['customerFiles'] });
      queryClient.invalidateQueries({ queryKey: ['approved-bookings'] });
      
      toast({
        title: t("common.success"),
        description: t("common.fileDeleted"),
      });
    } catch (error) {
      console.error('Error deleting file:', error);
      toast({
        title: t("common.error"),
        description: t("common.deleteError"),
        variant: "destructive",
      });
    } finally {
      setDeletingFileId(null);
    }
  };

  if (!loadedFiles || loadedFiles.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">{t("common.attachments")}</h3>
      <div className="space-y-2">
        {loadedFiles.map((file) => (
          <div key={file.id} className="flex items-center justify-between p-2 bg-background border rounded-md">
            <div className="flex items-center space-x-2 overflow-hidden">
              {isImage(file.filename) ? (
                <div className="h-8 w-8 bg-gray-100 rounded overflow-hidden flex items-center justify-center">
                  <img 
                    src={`${supabase.storage.from(bucketName).getPublicUrl(file.file_path).data.publicUrl}`} 
                    alt={file.filename}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      console.error('Image load error', e);
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJsdWNpZGUgbHVjaWRlLWltYWdlIj48cmVjdCB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHg9IjMiIHk9IjMiIHJ4PSIyIiByeT0iMiIvPjxjaXJjbGUgY3g9IjguNSIgY3k9IjguNSIgcj0iMS41Ii8+PHBvbHlsaW5lIHBvaW50cz0iMjEgMTUgMTYgMTAgNSAyMSIvPjwvc3ZnPg==';
                    }}
                  />
                </div>
              ) : (
                <div className="h-8 w-8 bg-gray-100 rounded flex items-center justify-center">
                  {getFileIcon(file.filename)}
                </div>
              )}
              <span className="truncate text-sm">{file.filename}</span>
            </div>
            <div className="flex space-x-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleDownload(file.file_path, file.filename)}
                title={t("common.download")}
              >
                <Download className="h-4 w-4" />
              </Button>
              {allowDelete && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(file.id, file.file_path)}
                  disabled={deletingFileId === file.id}
                  title={t("common.delete")}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
