
import { Button } from "@/components/ui/button";
import { supabase, getStorageUrl } from "@/integrations/supabase/client";
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

  console.log("📁 FileDisplay - Files received:", files.length, "files");
  console.log("📁 FileDisplay - Primary bucket:", bucketName);

  // Remove duplicate files
  const uniqueFiles = files.filter((file, index, self) => 
    index === self.findIndex(f => f.id === file.id)
  );

  console.log("📁 FileDisplay - Unique files after dedup:", uniqueFiles.length);

  useEffect(() => {
    const setupFileUrls = async () => {
      console.log("🔧 FileDisplay - Setting up file URLs for", uniqueFiles.length, "files");
      const newURLs: {[key: string]: string} = {};
      
      for (const file of uniqueFiles) {
        if (!file.file_path) {
          console.log("⚠️ FileDisplay - Skipping file with no path:", file.filename);
          continue;
        }
        
        // Clean file path - remove leading slashes
        const cleanPath = file.file_path.replace(/^\/+/, '');
        console.log("🔧 FileDisplay - Processing file:", file.filename, "Path:", cleanPath);
        
        // Try primary bucket first, then fallbacks
        const bucketsToTry = [bucketName, ...fallbackBuckets];
        let fileUrl = null;
        
        for (const bucket of bucketsToTry) {
          try {
            // Create public URL for the file
            const { data } = supabase.storage
              .from(bucket)
              .getPublicUrl(cleanPath);
            
            if (data?.publicUrl) {
              fileUrl = data.publicUrl;
              console.log("✅ FileDisplay - Found file in bucket:", bucket, "URL:", fileUrl);
              break;
            }
          } catch (error) {
            console.log("❌ FileDisplay - Error accessing file in bucket:", bucket, error);
          }
        }
        
        if (fileUrl) {
          newURLs[file.id] = fileUrl;
        } else {
          console.log("❌ FileDisplay - Could not find file:", file.filename, "in any bucket");
          // Create fallback URL anyway
          newURLs[file.id] = `${getStorageUrl()}/object/public/${bucketName}/${cleanPath}`;
        }
      }
      
      console.log("🔧 FileDisplay - Setup complete. URLs created:", Object.keys(newURLs).length);
      setFileURLs(newURLs);
    };
    
    if (uniqueFiles.length > 0) {
      setupFileUrls();
    }
  }, [uniqueFiles, bucketName, fallbackBuckets]);

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
      console.log("⬇️ FileDisplay - Starting download for:", fileName);
      const cleanPath = filePath.replace(/^\/+/, '');
      
      // Try to download from primary bucket first
      const bucketsToTry = [bucketName, ...fallbackBuckets];
      let downloadSuccess = false;
      
      for (const bucket of bucketsToTry) {
        try {
          const { data, error } = await supabase.storage
            .from(bucket)
            .download(cleanPath);
          
          if (data && !error) {
            const url = window.URL.createObjectURL(data);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            console.log("✅ FileDisplay - Download successful from bucket:", bucket);
            downloadSuccess = true;
            break;
          }
        } catch (error) {
          console.log("❌ FileDisplay - Download failed from bucket:", bucket, error);
        }
      }
      
      if (downloadSuccess) {
        toast({
          title: t("common.success"),
          description: t("common.downloadStarted"),
        });
      } else {
        throw new Error("File not found in any bucket");
      }
    } catch (error) {
      console.error('💥 FileDisplay - Download error:', error);
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
      console.log("🔗 FileDisplay - Opening file:", fileUrl);
      window.open(fileUrl, '_blank', 'noopener,noreferrer');
    } else {
      console.log("❌ FileDisplay - No URL available for file");
      toast({
        title: t("common.error"),
        description: t("common.fileAccessError"),
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (fileId: string, filePath: string) => {
    try {
      console.log("🗑️ FileDisplay - Starting delete for file:", fileId);
      setDeletingFileId(fileId);
      
      const cleanPath = filePath.replace(/^\/+/, '');
      
      // Delete from storage - try all possible buckets
      const bucketsToTry = [bucketName, ...fallbackBuckets];
      for (const bucket of bucketsToTry) {
        try {
          const { error: storageError } = await supabase.storage
            .from(bucket)
            .remove([cleanPath]);
          
          if (!storageError) {
            console.log("✅ FileDisplay - File deleted from storage bucket:", bucket);
            break;
          }
        } catch (error) {
          console.log("❌ FileDisplay - Failed to delete from bucket:", bucket, error);
        }
      }
      
      // Delete from database - determine correct table
      let tableName: "files" | "customer_files_new" | "note_files" | "event_files";
      
      if (parentType === 'task') {
        tableName = "files";
      } else if (parentType === 'customer') {
        tableName = "customer_files_new";
      } else if (parentType === 'note') {
        tableName = "note_files";
      } else {
        tableName = "event_files";
      }
      
      console.log("🗑️ FileDisplay - Deleting from database table:", tableName);
      const { error: dbError } = await supabase
        .from(tableName)
        .delete()
        .eq('id', fileId);
        
      if (dbError) {
        console.error("❌ FileDisplay - Database deletion error:", dbError);
        throw dbError;
      }
      
      console.log("✅ FileDisplay - File deleted successfully");
      
      // Call callback and invalidate queries
      if (onFileDeleted) {
        onFileDeleted(fileId);
      }
      
      queryClient.invalidateQueries({ queryKey: ['files'] });
      queryClient.invalidateQueries({ queryKey: ['taskFiles'] });
      queryClient.invalidateQueries({ queryKey: ['eventFiles'] });
      queryClient.invalidateQueries({ queryKey: ['customerFiles'] });
      
      toast({
        title: t("common.success"),
        description: t("common.fileDeleted"),
      });
    } catch (error) {
      console.error('💥 FileDisplay - Delete error:', error);
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
    return null;
  }

  return (
    <div className="space-y-2">
      {uniqueFiles.map((file) => {
        if (!file.file_path) {
          console.log("⚠️ FileDisplay - Skipping file with no path:", file.filename);
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
                        console.error('🖼️ FileDisplay - Image load failed:', imageUrl);
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
