
import { Button } from "@/components/ui/button";
import { supabase, getStorageUrl, normalizeFilePath } from "@/integrations/supabase/client";
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
  const [validatedBuckets, setValidatedBuckets] = useState<{[key: string]: string}>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  console.log("FileDisplay - Files received:", files);
  console.log("FileDisplay - Primary bucket:", bucketName);

  // Remove duplicate files using a simple approach
  const uniqueFiles = files.filter((file, index, self) => 
    index === self.findIndex(f => f.id === file.id && f.file_path === file.file_path)
  );

  console.log("FileDisplay - Unique files:", uniqueFiles);

  useEffect(() => {
    const setupFileUrls = async () => {
      const newURLs: {[key: string]: string} = {};
      const newBuckets: {[key: string]: string} = {};
      
      // List of buckets to try in order
      const bucketsToTry = [bucketName, ...fallbackBuckets, 'event_attachments', 'customer_attachments'];
      
      for (const file of uniqueFiles) {
        if (!file.file_path) {
          console.log(`Skipping file ${file.filename} - no file path`);
          continue;
        }
        
        const normalizedPath = normalizeFilePath(file.file_path);
        let foundBucket = null;
        
        // Try each bucket until we find the file
        for (const bucket of bucketsToTry) {
          try {
            console.log(`Checking file ${file.filename} in bucket ${bucket} at path ${normalizedPath}`);
            
            // Try to create a signed URL to test if file exists
            const { data, error } = await supabase.storage
              .from(bucket)
              .createSignedUrl(normalizedPath, 60);
            
            if (data && !error) {
              foundBucket = bucket;
              console.log(`✅ File ${file.filename} found in bucket ${bucket}`);
              break;
            }
          } catch (error) {
            console.log(`❌ Error checking file in ${bucket}:`, error);
          }
        }
        
        // Use found bucket or default to primary bucket
        const effectiveBucket = foundBucket || bucketName;
        newBuckets[file.id] = effectiveBucket;
        newURLs[file.id] = `${getStorageUrl()}/object/public/${effectiveBucket}/${normalizedPath}`;
        
        console.log(`File ${file.filename} will use bucket: ${effectiveBucket}`);
      }
      
      setValidatedBuckets(newBuckets);
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
      const effectiveBucket = validatedBuckets[fileId] || bucketName;
      const normalizedPath = normalizeFilePath(filePath);
      
      console.log(`Downloading file: ${fileName} from ${effectiveBucket}:${normalizedPath}`);
      
      // Create a fresh signed URL for download
      const { data, error } = await supabase.storage
        .from(effectiveBucket)
        .createSignedUrl(normalizedPath, 300);
      
      if (error || !data?.signedUrl) {
        throw new Error(`Failed to create download URL: ${error?.message}`);
      }
      
      // Download the file
      const response = await fetch(data.signedUrl);
      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      // Create download link
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: t("common.success"),
        description: t("common.downloadStarted"),
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: t("common.error"),
        description: t("common.downloadError"),
        variant: "destructive",
      });
    }
  };

  const handleOpenFile = async (filePath: string, fileId: string) => {
    try {
      const effectiveBucket = validatedBuckets[fileId] || bucketName;
      const normalizedPath = normalizeFilePath(filePath);
      
      // Create a signed URL for viewing
      const { data, error } = await supabase.storage
        .from(effectiveBucket)
        .createSignedUrl(normalizedPath, 3600);
      
      if (error || !data?.signedUrl) {
        throw new Error(`Failed to create view URL: ${error?.message}`);
      }
      
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Open file error:', error);
      toast({
        title: t("common.error"),
        description: t("common.fileAccessError"),
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (fileId: string, filePath: string) => {
    try {
      setDeletingFileId(fileId);
      
      const effectiveBucket = validatedBuckets[fileId] || bucketName;
      const normalizedPath = normalizeFilePath(filePath);
      
      console.log(`Deleting file from ${effectiveBucket}:${normalizedPath}`);
      
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from(effectiveBucket)
        .remove([normalizedPath]);

      if (storageError) {
        console.error('Storage deletion error:', storageError);
        throw storageError;
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
      
      console.log(`Deleting file record from ${tableName}, id: ${fileId}`);
      const { error: dbError } = await supabase
        .from(tableName)
        .delete()
        .eq('id', fileId);
        
      if (dbError) {
        console.error(`Database deletion error from ${tableName}:`, dbError);
        throw dbError;
      }
      
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
      console.error('Delete error:', error);
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
    return null;
  }

  return (
    <div className="space-y-2">
      {uniqueFiles.map((file) => {
        if (!file.file_path) return null;
        
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
                        console.error('Image load failed:', imageUrl);
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
