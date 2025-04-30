
import { Button } from "@/components/ui/button";
import { Download, Trash2, FileIcon, ExternalLink } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { 
  getFileUrl, 
  deleteFile, 
  invalidateFileQueries,
  STORAGE_BUCKETS 
} from "@/services/fileService";
import type { FileRecord } from "@/types/files";

interface FileDisplayProps {
  files: FileRecord[];
  bucketName?: string;  // Only kept for backward compatibility
  allowDelete?: boolean;
  onFileDeleted?: (fileId: string) => void;
  parentId?: string;
  parentType?: string;
}

export const FileDisplay = ({ 
  files, 
  allowDelete = false, 
  onFileDeleted,
  parentId,
  parentType = 'event'
}: FileDisplayProps) => {
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const [fileURLs, setFileURLs] = useState<{[key: string]: string}>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  // Verify input data for debugging
  useEffect(() => {
    if (files && files.length > 0) {
      console.log("Files data in FileDisplay:", files.length);
    } else {
      console.log("No files provided to FileDisplay component");
    }
  }, [files]);

  // Remove duplicate files based on file_path to prevent showing the same file twice
  const uniqueFiles = files.reduce((acc: FileRecord[], current) => {
    const isDuplicate = acc.some(item => item.file_path === current.file_path);
    if (!isDuplicate) {
      acc.push(current);
    }
    return acc;
  }, []);

  // Generate consistent file URLs using the standardized helper
  useEffect(() => {
    const newURLs: {[key: string]: string} = {};
    uniqueFiles.forEach(file => {
      if (file.file_path) {
        newURLs[file.id] = getFileUrl(file.file_path);
      }
    });
    setFileURLs(newURLs);
  }, [uniqueFiles]);

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

  const handleDownload = async (filePath: string, fileName: string, fileId: string) => {
    try {
      console.log(`Downloading file: ${fileName}`);
      
      const directUrl = fileURLs[fileId] || getFileUrl(filePath);
      
      // Force download using fetch to get the blob
      const response = await fetch(directUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
      }
      
      const blob = await response.blob();
      
      // Create blob URL and handle download
      const blobUrl = window.URL.createObjectURL(blob);
      
      // Create a hidden anchor element for download
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName;
      a.style.display = 'none';
      
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl);
      }, 100);
      
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

  const handleOpenFile = async (filePath: string, fileId: string) => {
    try {
      if (!filePath) {
        throw new Error('File path is missing');
      }
      
      const directUrl = fileURLs[fileId] || getFileUrl(filePath);
      
      // Open in a new tab
      window.open(directUrl, '_blank', 'noopener,noreferrer');
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
      
      // Use the centralized deleteFile function
      const success = await deleteFile(filePath, fileId, parentType || 'event');

      if (!success) {
        throw new Error('Failed to delete file');
      }
      
      if (onFileDeleted) {
        onFileDeleted(fileId);
      }
      
      // Invalidate all related queries
      invalidateFileQueries(queryClient);
      
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

  if (!uniqueFiles || uniqueFiles.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="space-y-2">
        {uniqueFiles.map((file) => {
          if (!file.file_path) {
            console.warn(`File ${file.id} has no file_path, skipping render`);
            return null;
          }
          
          const fileNameDisplay = file.filename && file.filename.length > 20 
            ? file.filename.substring(0, 20) + '...' 
            : file.filename;
          
          // Get consistent image URL
          const imageUrl = fileURLs[file.id] || getFileUrl(file.file_path);
            
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
                          console.error('Image failed to load', e);
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
                    title={t("common.download") || "Download"}
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
                      title={t("common.delete") || "Delete"}
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
                {t("crm.open") || "Open"}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
