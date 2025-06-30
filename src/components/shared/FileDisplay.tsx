
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Download, Trash2, FileIcon, ExternalLink, FileText, FileSpreadsheet, PresentationIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import type { FileRecord } from "@/types/files";

interface FileDisplayProps {
  files: FileRecord[];
  bucketName: string;
  allowDelete?: boolean;
  onFileDeleted?: (fileId: string) => void;
  parentId?: string;
  parentType?: string;
  fallbackBuckets?: string[];
}

export const FileDisplay = ({ 
  files, 
  bucketName, 
  allowDelete = false, 
  onFileDeleted,
  parentId,
  parentType,
  fallbackBuckets = []
}: FileDisplayProps) => {
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  console.log("📁 FileDisplay - Rendering with files:", files.length);

  // Remove duplicate files by ID
  const uniqueFiles = files.filter((file, index, self) => 
    index === self.findIndex(f => f.id === file.id)
  );

  const getFileExtension = (filename: string): string => {
    return filename.split('.').pop()?.toLowerCase() || '';
  };
  
  const isImage = (filename: string): boolean => {
    const ext = getFileExtension(filename);
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);
  };

  const getFileIcon = (filename: string) => {
    const ext = getFileExtension(filename);
    
    if (['pdf', 'doc', 'docx'].includes(ext)) {
      return <FileText className="h-5 w-5" />;
    } else if (['xls', 'xlsx', 'csv'].includes(ext)) {
      return <FileSpreadsheet className="h-5 w-5" />;
    } else if (['ppt', 'pptx'].includes(ext)) {
      return <PresentationIcon className="h-5 w-5" />;
    }
    
    return <FileIcon className="h-5 w-5" />;
  };

  const getPublicUrl = (filePath: string) => {
    // Try to get public URL from storage
    const { data } = supabase.storage
      .from('event_attachments')
      .getPublicUrl(filePath);
    
    return data?.publicUrl || null;
  };

  const handleDownload = async (filePath: string, fileName: string) => {
    try {
      console.log(`⬇️ Downloading file: ${fileName} from path: ${filePath}`);
      
      const { data, error } = await supabase.storage
        .from('event_attachments')
        .download(filePath);
      
      if (error) {
        console.error("Download error:", error);
        throw error;
      }
      
      if (data) {
        const url = window.URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        toast({
          title: t("common.success"),
          description: t("common.downloadStarted"),
        });
      }
    } catch (error) {
      console.error("Download failed:", error);
      toast({
        title: t("common.error"),
        description: t("common.downloadError"),
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (fileId: string, filePath: string) => {
    try {
      console.log(`🗑️ Deleting file: ${fileId}, path: ${filePath}`);
      setDeletingFileId(fileId);
      
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('event_attachments')
        .remove([filePath]);
      
      if (storageError) {
        console.warn("Storage deletion warning:", storageError);
      }
      
      // Delete from database based on parent type
      let dbError: any = null;
      
      if (parentType === 'task') {
        const { error } = await supabase
          .from('files')
          .delete()
          .eq('id', fileId);
        dbError = error;
      } else if (parentType === 'customer') {
        const { error } = await supabase
          .from('customer_files_new')
          .delete()
          .eq('id', fileId);
        dbError = error;
      } else if (parentType === 'note') {
        const { error } = await supabase
          .from('note_files')
          .delete()
          .eq('id', fileId);
        dbError = error;
      } else {
        const { error } = await supabase
          .from('event_files')
          .delete()
          .eq('id', fileId);
        dbError = error;
      }
        
      if (dbError) {
        console.error("Database deletion error:", dbError);
        throw dbError;
      }
      
      console.log("✅ File deleted successfully");
      
      // Invalidate queries
      await queryClient.invalidateQueries({ queryKey: ['files'] });
      await queryClient.invalidateQueries({ queryKey: ['taskFiles'] });
      await queryClient.invalidateQueries({ queryKey: ['eventFiles'] });
      await queryClient.invalidateQueries({ queryKey: ['customerFiles'] });
      
      if (onFileDeleted) {
        onFileDeleted(fileId);
      }
      
      toast({
        title: t("common.success"),
        description: t("common.fileDeleted"),
      });
    } catch (error) {
      console.error("Delete failed:", error);
      toast({
        title: t("common.error"),
        description: t("common.deleteError"),
        variant: "destructive",
      });
    } finally {
      setDeletingFileId(null);
    }
  };

  if (!uniqueFiles || uniqueFiles.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        {t("common.noFilesFound")}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {uniqueFiles.map((file) => {
        if (!file.file_path) {
          console.warn("Skipping file with no path:", file.filename);
          return null;
        }
        
        const fileNameDisplay = file.filename && file.filename.length > 20 
          ? file.filename.substring(0, 20) + '...' 
          : file.filename;
          
        const publicUrl = getPublicUrl(file.file_path);
          
        return (
          <div key={file.id} className="flex flex-col bg-background border rounded-md overflow-hidden">
            <div className="p-3 flex items-center justify-between">
              <div className="flex items-center space-x-2 overflow-hidden">
                {isImage(file.filename) && publicUrl ? (
                  <div className="h-8 w-8 bg-gray-100 rounded overflow-hidden flex items-center justify-center">
                    <img 
                      src={publicUrl}
                      alt={file.filename}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        console.error("Image load failed:", publicUrl);
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                ) : (
                  <div className="h-8 w-8 bg-gray-100 rounded flex items-center justify-center">
                    {getFileIcon(file.filename)}
                  </div>
                )}
                <span className="truncate text-sm">{fileNameDisplay}</span>
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
            
            {publicUrl && (
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-none border-t flex items-center justify-center gap-2 py-1.5"
                onClick={() => window.open(publicUrl, '_blank', 'noopener,noreferrer')}
              >
                <ExternalLink className="h-4 w-4" />
                {t("crm.open")}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
};
