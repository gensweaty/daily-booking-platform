
import { Button } from "@/components/ui/button";
import { supabase, getStorageUrl, normalizeFilePath } from "@/lib/supabase";
import { Download, Trash2, FileIcon, ExternalLink } from "lucide-react";
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
  const [fileURLs, setFileURLs] = useState<{[key: string]: string}>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  // Cache file URLs to prevent repeated calculations
  useEffect(() => {
    const newURLs: {[key: string]: string} = {};
    files.forEach(file => {
      if (file.file_path) {
        const normalizedPath = normalizeFilePath(file.file_path);
        // Prioritize event_attachments if the path matches event patterns
        const effectiveBucket = determineEffectiveBucket(file.file_path, parentType, file.source);
        console.log(`File ${file.filename}: Using bucket ${effectiveBucket} for path ${file.file_path}`);
        newURLs[file.id] = `${getStorageUrl()}/object/public/${effectiveBucket}/${normalizedPath}`;
      }
    });
    setFileURLs(newURLs);
  }, [files, parentType]);

  const getFileExtension = (filename: string): string => {
    return filename.split('.').pop()?.toLowerCase() || '';
  };
  
  const isImage = (filename: string): boolean => {
    const ext = getFileExtension(filename);
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);
  };

  const getFileIcon = (filename: string) => {
    return <FileIcon className="h-5 w-5" />;
  };

  // Determine the correct bucket based on file path, parent type, and source
  const determineEffectiveBucket = (filePath: string, parentType?: string, source?: string): string => {
    // If the file has explicit source marker from query, use that
    if (source === 'event') {
      return "event_attachments";
    }
    
    if (source === 'customer') {
      return "customer_attachments";
    }
    
    // File patterns that indicate event attachments
    if (filePath && (
      filePath.includes("b22b") || 
      /^\d{13}_/.test(filePath) || 
      filePath.includes("event_") ||
      filePath.startsWith("event/")
    )) {
      return "event_attachments";
    }
    
    // For customer attachments in the CRM
    if (parentType === "customer" && filePath && 
      !filePath.includes("b22b") && 
      !/^\d{13}_/.test(filePath) &&
      !filePath.includes("event_") &&
      !filePath.startsWith("event/")) {
      return "customer_attachments";
    }
    
    // Events should always use event_attachments
    if (parentType === "event") {
      return "event_attachments";
    }
    
    // Default fallback - use the provided bucket name
    return bucketName;
  };

  const handleDownload = async (filePath: string, fileName: string, fileId: string) => {
    try {
      console.log(`Attempting to download file: ${fileName}, path: ${filePath}`);
      
      // Build URL using the effective bucket
      const effectiveBucket = determineEffectiveBucket(filePath, parentType);
      console.log(`Download: Using bucket ${effectiveBucket} for path ${filePath}`);
      
      const directUrl = fileURLs[fileId] || 
        `${getStorageUrl()}/object/public/${effectiveBucket}/${normalizeFilePath(filePath)}`;
      
      console.log('Using direct URL for download:', directUrl);
      
      const a = document.createElement('a');
      a.href = directUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      toast({
        title: t("common.success"),
        description: t("common.downloadStarted"),
      });
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({
        title: t("common.error"),
        description: t("common.downloadError"),
        variant: "destructive",
      });
    }
  };

  // Get direct URL that works consistently across both views
  const getDirectFileUrl = (filePath: string, fileId: string): string => {
    if (!filePath) return '';
    
    // Use the cached URL if available for better performance
    if (fileURLs[fileId]) {
      return fileURLs[fileId];
    }
    
    const normalizedPath = normalizeFilePath(filePath);
    const effectiveBucket = determineEffectiveBucket(filePath, parentType);
    console.log(`Open: Using bucket ${effectiveBucket} for path ${filePath}`);
    
    // Create a public URL for the file
    return `${getStorageUrl()}/object/public/${effectiveBucket}/${normalizedPath}`;
  };

  const handleOpenFile = async (filePath: string, fileId: string) => {
    try {
      if (!filePath) {
        throw new Error('File path is missing');
      }
      
      // Use direct URL construction for consistency
      const directUrl = getDirectFileUrl(filePath, fileId);
      console.log('Opening file with direct URL:', directUrl);
      window.open(directUrl, '_blank');
    } catch (error) {
      console.error('Error opening file:', error);
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
      
      // Determine the correct bucket for deletion
      const effectiveBucket = determineEffectiveBucket(filePath, parentType);
      console.log(`Deleting file from bucket ${effectiveBucket}, path: ${filePath}`);
      
      // First delete the file from storage
      const { error: storageError } = await supabase.storage
        .from(effectiveBucket)
        .remove([normalizeFilePath(filePath)]);

      if (storageError) {
        console.error('Error deleting file from storage:', storageError);
        throw storageError;
      }
      
      // Then delete the database record based on the file type
      let tableName = 'files';
      if (effectiveBucket === 'event_attachments' || parentType === 'event') {
        tableName = 'event_files';
      } else if (effectiveBucket === 'customer_attachments' || parentType === 'customer') {
        tableName = 'customer_files_new';
      } else if (effectiveBucket === 'note_attachments' || parentType === 'note') {
        tableName = 'note_files';
      }
      
      console.log(`Deleting file record from table ${tableName}, id: ${fileId}`);
      const { error: dbError } = await supabase
        .from(tableName)
        .delete()
        .eq('id', fileId);
        
      if (dbError) {
        console.error(`Error deleting file from ${tableName}:`, dbError);
        throw dbError;
      }
      
      // Notify parent component
      if (onFileDeleted) {
        onFileDeleted(fileId);
      }
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['files'] });
      queryClient.invalidateQueries({ queryKey: ['taskFiles'] });
      queryClient.invalidateQueries({ queryKey: ['noteFiles'] });
      queryClient.invalidateQueries({ queryKey: ['eventFiles'] });
      queryClient.invalidateQueries({ queryKey: ['customerFiles'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      
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

  if (!files || files.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">{t("common.attachments")}</h3>
      <div className="space-y-2">
        {files.map((file) => {
          // Skip files without a path
          if (!file.file_path) return null;
          
          const fileNameDisplay = file.filename && file.filename.length > 20 
            ? file.filename.substring(0, 20) + '...' 
            : file.filename;
          
          // Determine the correct bucket and build the image URL
          const effectiveBucket = determineEffectiveBucket(file.file_path, parentType, file.source);
          const imageUrl = fileURLs[file.id] || 
            `${getStorageUrl()}/object/public/${effectiveBucket}/${normalizeFilePath(file.file_path)}`;
            
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
                          console.error('Image failed to load', e, 'URL:', imageUrl);
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
    </div>
  );
};
