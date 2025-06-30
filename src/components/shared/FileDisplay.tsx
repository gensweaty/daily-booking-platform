
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
  const [fileURLs, setFileURLs] = useState<{[key: string]: string}>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  console.log("📁 FileDisplay - Initializing with:", {
    filesCount: files.length,
    bucketName,
    parentType,
    parentId,
    files: files.map(f => ({ id: f.id, filename: f.filename, file_path: f.file_path }))
  });

  // Remove duplicate files by ID
  const uniqueFiles = files.filter((file, index, self) => 
    index === self.findIndex(f => f.id === file.id)
  );

  console.log(`📁 FileDisplay - Processing ${uniqueFiles.length} unique files`);

  useEffect(() => {
    const setupFileUrls = async () => {
      if (uniqueFiles.length === 0) {
        console.log("📁 FileDisplay - No files to process");
        return;
      }

      console.log("🔧 FileDisplay - Setting up file URLs");
      const newURLs: {[key: string]: string} = {};
      
      for (const file of uniqueFiles) {
        if (!file.file_path) {
          console.warn("⚠️ FileDisplay - File missing path:", file.filename);
          continue;
        }
        
        // Clean the path - remove leading slash if present
        const cleanPath = file.file_path.startsWith('/') ? file.file_path.substring(1) : file.file_path;
        
        console.log(`🔧 FileDisplay - Processing file: ${file.filename}, original path: ${file.file_path}, clean path: ${cleanPath}`);
        
        try {
          // Try event_attachments bucket first (most common)
          const { data } = supabase.storage
            .from('event_attachments')
            .getPublicUrl(cleanPath);
          
          if (data?.publicUrl) {
            newURLs[file.id] = data.publicUrl;
            console.log(`✅ FileDisplay - URL created for ${file.filename}: ${data.publicUrl}`);
          } else {
            console.warn(`⚠️ FileDisplay - Failed to create URL for ${file.filename}`);
          }
        } catch (error) {
          console.error(`❌ FileDisplay - Error creating URL for ${file.filename}:`, error);
        }
      }
      
      console.log(`🔧 FileDisplay - Setup complete. Created ${Object.keys(newURLs).length} URLs out of ${uniqueFiles.length} files`);
      setFileURLs(newURLs);
    };
    
    setupFileUrls();
  }, [uniqueFiles]);

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

  const handleDownload = async (filePath: string, fileName: string, fileId: string) => {
    try {
      console.log(`⬇️ FileDisplay - Starting download: ${fileName} from path: ${filePath}`);
      
      const cleanPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
      
      const { data, error } = await supabase.storage
        .from('event_attachments')
        .download(cleanPath);
      
      if (error) {
        console.error(`❌ FileDisplay - Download error:`, error);
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
        
        console.log(`✅ FileDisplay - Download successful: ${fileName}`);
        
        toast({
          title: t("common.success"),
          description: t("common.downloadStarted"),
        });
      }
    } catch (error) {
      console.error(`❌ FileDisplay - Download failed for ${fileName}:`, error);
      toast({
        title: t("common.error"),
        description: t("common.downloadError"),
        variant: "destructive",
      });
    }
  };

  const handleOpenFile = (filePath: string, fileId: string) => {
    const fileUrl = fileURLs[fileId];
    if (fileUrl) {
      console.log(`🔗 FileDisplay - Opening file: ${fileUrl}`);
      window.open(fileUrl, '_blank', 'noopener,noreferrer');
    } else {
      console.error(`❌ FileDisplay - No URL available for file ID: ${fileId}`);
      toast({
        title: t("common.error"),
        description: t("common.fileAccessError"),
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (fileId: string, filePath: string) => {
    try {
      console.log(`🗑️ FileDisplay - Starting delete for file: ${fileId}, path: ${filePath}`);
      setDeletingFileId(fileId);
      
      const cleanPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
      
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('event_attachments')
        .remove([cleanPath]);
      
      if (storageError) {
        console.warn("⚠️ FileDisplay - Storage deletion warning:", storageError);
        // Continue with database deletion even if storage fails
      }
      
      // Delete from database using explicit table names
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
        console.error("❌ FileDisplay - Database deletion error:", dbError);
        throw dbError;
      }
      
      console.log("✅ FileDisplay - File deleted successfully");
      
      // Invalidate all relevant queries
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
      console.error(`❌ FileDisplay - Delete failed:`, error);
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
    console.log("📁 FileDisplay - No files to display");
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
          console.warn("⚠️ FileDisplay - Skipping file with no path:", file.filename);
          return null;
        }
        
        const fileNameDisplay = file.filename && file.filename.length > 20 
          ? file.filename.substring(0, 20) + '...' 
          : file.filename;
          
        const imageUrl = fileURLs[file.id];
          
        return (
          <div key={file.id} className="flex flex-col bg-background border rounded-md overflow-hidden">
            <div className="p-3 flex items-center justify-between">
              <div className="flex items-center space-x-2 overflow-hidden">
                {isImage(file.filename) ? (
                  <div className="h-8 w-8 bg-gray-100 rounded overflow-hidden flex items-center justify-center">
                    <img 
                      src={imageUrl}
                      alt={file.filename}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        console.error(`🖼️ FileDisplay - Image load failed: ${imageUrl}`);
                        e.currentTarget.src = '/placeholder.svg';
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
                  onClick={() => handleDownload(file.file_path, file.filename, file.id)}
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
            
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-none border-t flex items-center justify-center gap-2 py-1.5"
              onClick={() => handleOpenFile(file.file_path, file.id)}
            >
              <ExternalLink className="h-4 w-4" />
              {t("crm.open")}
            </Button>
          </div>
        );
      })}
    </div>
  );
};
