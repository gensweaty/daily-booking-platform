
import { Button } from "@/components/ui/button";
import { supabase, getStorageUrl, normalizeFilePath } from "@/integrations/supabase/client";
import { Download, Trash2, FileIcon, ExternalLink, FileText, FileSpreadsheet, PresentationIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import type { FileRecord } from "@/types/files";

// Component for rendering image thumbnails with proper bucket detection
const ImageThumbnail = ({ file, parentType }: { file: FileRecord; parentType: string }) => {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  
  useEffect(() => {
    const loadThumbnail = async () => {
      const getBucketName = (type: string): string => {
        switch (type) {
          case 'task': return 'task_attachments';
          case 'event': return 'event_attachments';
          case 'customer': return 'customer_attachments';
          case 'note': return 'event_attachments';
          default: return 'event_attachments';
        }
      };
      
      const primaryBucket = getBucketName(parentType);
      const fallbackBuckets = [
        'chat_attachments',
        'task_attachments',
        'event_attachments',
        'customer_attachments'
      ].filter(b => b !== primaryBucket);
      
      const allBuckets = [primaryBucket, ...fallbackBuckets];
      
      for (const bucket of allBuckets) {
        let pathToCheck = normalizeFilePath(file.file_path);
        
        const bucketPrefix = `${bucket}/`;
        if (pathToCheck.startsWith(bucketPrefix)) {
          pathToCheck = pathToCheck.substring(bucketPrefix.length);
        }
        
        try {
          const { data, error } = await supabase.storage
            .from(bucket)
            .createSignedUrl(pathToCheck, 300);
          
          if (!error && data?.signedUrl) {
            setThumbnailUrl(data.signedUrl);
            return;
          }
        } catch (e) {
          // Continue to next bucket
        }
      }
      
      // Fallback to placeholder if not found
      setThumbnailUrl('/placeholder.svg');
    };
    
    loadThumbnail();
  }, [file.file_path, parentType]);
  
  return (
    <div className="h-8 w-8 bg-gray-100 rounded overflow-hidden flex items-center justify-center">
      {thumbnailUrl ? (
        <img 
          src={thumbnailUrl}
          alt={file.filename}
          className="h-full w-full object-cover"
          onError={(e) => {
            e.currentTarget.src = '/placeholder.svg';
          }}
        />
      ) : (
        <div className="h-full w-full bg-gray-200 animate-pulse" />
      )}
    </div>
  );
};

interface SimpleFileDisplayProps {
  files: FileRecord[];
  parentType: 'task' | 'event' | 'customer' | 'note';
  allowDelete?: boolean;
  onFileDeleted?: (fileId: string) => void;
  parentId?: string;
  // Permission props for sub-users
  currentUserName?: string;
  currentUserType?: string;
  isSubUser?: boolean;
}

export const SimpleFileDisplay = ({ 
  files, 
  parentType,
  allowDelete = false, 
  onFileDeleted,
  parentId,
  currentUserName,
  currentUserType = 'admin',
  isSubUser = false
}: SimpleFileDisplayProps) => {
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  // Correct bucket mapping based on parent type
  const getBucketName = (type: string): string => {
    switch (type) {
      case 'task': return 'task_attachments';
      case 'event': return 'event_attachments';
      case 'customer': return 'customer_attachments';
      case 'note': return 'event_attachments'; // Notes use event_attachments for now
      default: return 'event_attachments';
    }
  };

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

  const checkFileExistence = async (bucketName: string, filePath: string): Promise<boolean> => {
    try {
      const normalizedPath = normalizeFilePath(filePath);
      const { data, error } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(normalizedPath, 5);
      
      if (error || !data) {
        return false;
      }
      
      return true;
    } catch (error) {
      return false;
    }
  };

  const generateSignedUrl = async (bucketName: string, filePath: string): Promise<string | null> => {
    try {
      const normalizedPath = normalizeFilePath(filePath);
      console.log(`Generating signed URL for ${bucketName}:${normalizedPath}`);
      
      const { data, error } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(normalizedPath, 300);
      
      if (error || !data) {
        console.error(`Error generating signed URL for ${bucketName}:${normalizedPath}`, error);
        return null;
      }
      
      console.log(`Successfully generated signed URL for ${bucketName}:${normalizedPath}`);
      return data.signedUrl;
    } catch (error) {
      console.error(`Error in generateSignedUrl:`, error);
      return null;
    }
  };

  // Enhanced function to find the correct bucket for a file
  const findFileBucket = async (file: FileRecord): Promise<string> => {
    const primaryBucket = getBucketName(parentType);
    const fallbackBuckets = [
      'chat_attachments',    // For AI-uploaded files
      'task_attachments',
      'event_attachments',
      'customer_attachments'
    ].filter(b => b !== primaryBucket); // Don't duplicate primary bucket
    
    const allBuckets = [primaryBucket, ...fallbackBuckets];
    
    for (const bucket of allBuckets) {
      let pathToCheck = normalizeFilePath(file.file_path);
      
      // Strip bucket prefix if it exists in the path
      const bucketPrefix = `${bucket}/`;
      if (pathToCheck.startsWith(bucketPrefix)) {
        pathToCheck = pathToCheck.substring(bucketPrefix.length);
      }
      
      console.log(`Checking if file ${file.filename} exists in ${bucket} at ${pathToCheck}`);
      const exists = await checkFileExistence(bucket, pathToCheck);
      
      if (exists) {
        console.log(`File found in ${bucket}`);
        return bucket;
      }
    }
    
    // Default to primary bucket if not found anywhere
    console.log(`File not found in any bucket, defaulting to ${primaryBucket}`);
    return primaryBucket;
  };

  const handleDownload = async (file: FileRecord) => {
    try {
      console.log(`Downloading file: ${file.filename}`);
      
      // Find the correct bucket for this file
      const bucketName = await findFileBucket(file);
      console.log(`Using bucket ${bucketName} for download`);
      
      let pathToUse = normalizeFilePath(file.file_path);
      
      // Strip bucket prefix if it exists
      const bucketPrefix = `${bucketName}/`;
      if (pathToUse.startsWith(bucketPrefix)) {
        pathToUse = pathToUse.substring(bucketPrefix.length);
      }
      
      const signedUrl = await generateSignedUrl(bucketName, pathToUse);
      
      if (!signedUrl) {
        throw new Error("Failed to generate download URL");
      }
      
      const response = await fetch(signedUrl);
      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }
      
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = file.filename;
      a.style.display = 'none';
      
      document.body.appendChild(a);
      a.click();
      
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl);
      }, 100);
      
      toast({
        title: t("common.success"),
        description: t("common.downloadStarted") || "Download started",
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: t("common.error"),
        description: t("common.downloadError") || "Download failed",
        variant: "destructive",
      });
    }
  };

  const handleOpenFile = async (file: FileRecord) => {
    try {
      console.log(`Opening file: ${file.filename}`);
      
      // Find the correct bucket for this file
      const bucketName = await findFileBucket(file);
      console.log(`Using bucket ${bucketName} for opening`);
      
      let pathToUse = normalizeFilePath(file.file_path);
      
      // Strip bucket prefix if it exists
      const bucketPrefix = `${bucketName}/`;
      if (pathToUse.startsWith(bucketPrefix)) {
        pathToUse = pathToUse.substring(bucketPrefix.length);
      }
      
      const signedUrl = await generateSignedUrl(bucketName, pathToUse);
      
      if (!signedUrl) {
        throw new Error("Failed to generate file URL");
      }
      
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Open file error:', error);
      toast({
        title: t("common.error"),
        description: t("common.fileAccessError") || "Cannot access file",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (file: FileRecord) => {
    try {
      setDeletingFileId(file.id);
      
      const bucketName = getBucketName(parentType);
      console.log(`Deleting file from ${bucketName}: ${file.filename}`);
      
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from(bucketName)
        .remove([normalizeFilePath(file.file_path)]);

      if (storageError) {
        console.error('Storage deletion error:', storageError);
        throw storageError;
      }
      
      // Delete from database using type-safe table references
      let dbError;
      
      if (parentType === 'task') {
        const { error } = await supabase
          .from('files')
          .delete()
          .eq('id', file.id);
        dbError = error;
      } else if (parentType === 'event') {
        const { error } = await supabase
          .from('event_files')
          .delete()
          .eq('id', file.id);
        dbError = error;
      } else if (parentType === 'customer') {
        const { error } = await supabase
          .from('customer_files_new')
          .delete()
          .eq('id', file.id);
        dbError = error;
      } else if (parentType === 'note') {
        const { error } = await supabase
          .from('note_files')
          .delete()
          .eq('id', file.id);
        dbError = error;
      }
        
      if (dbError) {
        console.error(`Database deletion error for ${parentType}:`, dbError);
        throw dbError;
      }
      
      if (onFileDeleted) {
        onFileDeleted(file.id);
      }
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['files'] });
      queryClient.invalidateQueries({ queryKey: ['taskFiles'] });
      queryClient.invalidateQueries({ queryKey: ['noteFiles'] });
      queryClient.invalidateQueries({ queryKey: ['eventFiles'] });
      queryClient.invalidateQueries({ queryKey: ['customerFiles'] });
      
      toast({
        title: t("common.success"),
        description: t("common.fileDeleted") || "File deleted",
      });
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: t("common.error"),
        description: t("common.deleteError") || "Delete failed",
        variant: "destructive",
      });
    } finally {
      setDeletingFileId(null);
    }
  };

  if (!files || files.length === 0) {
    return null;
  }

  // Function to check if current user can delete a file
  const canDeleteFile = (file: FileRecord): boolean => {
    if (!allowDelete) return false;
    
    // If user is not a sub-user (admin), they can delete any file
    if (!isSubUser) return true;
    
    // For sub-users, they should only be able to delete files they uploaded
    // However, since files don't always have direct user attribution, 
    // we use a more conservative approach for now
    
    if (parentType === 'task') {
      // For tasks, sub-users should not be able to delete files uploaded by admin users
      // This prevents sub-users from deleting files they didn't upload
      // In the future, this could be enhanced to check the actual file uploader
      return false; // Conservative: sub-users can't delete task files for now
    } else if (parentType === 'event') {
      // For events, files don't have direct user attribution, 
      // so we rely on event-level permissions which are handled at the dialog level
      return true; // Allow deletion if the event dialog allows it
    }
    
    // For other types (customer, note), allow deletion
    return true;
  };

  const bucketName = getBucketName(parentType);
  console.log(`SimpleFileDisplay rendering ${files.length} files for ${parentType} using bucket: ${bucketName}`);

  return (
    <div className="space-y-2">
      {files.map((file) => {
        if (!file.file_path) return null;
        
        const fileNameDisplay = file.filename && file.filename.length > 20 
          ? file.filename.substring(0, 20) + '...' 
          : file.filename;
          
        return (
          <div key={file.id} className="flex flex-col bg-background border rounded-md overflow-hidden">
            <div className="p-3 flex items-center justify-between">
              <div className="flex items-center space-x-2 overflow-hidden">
                {isImage(file.filename) ? (
                  <ImageThumbnail file={file} parentType={parentType} />
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
                  onClick={() => handleDownload(file)}
                  title={t("common.download") || "Download"}
                >
                  <Download className="h-4 w-4" />
                </Button>
                {canDeleteFile(file) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(file)}
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
              onClick={() => handleOpenFile(file)}
            >
              <ExternalLink className="h-4 w-4" />
              {t("crm.open") || "Open"}
            </Button>
          </div>
        );
      })}
    </div>
  );
};
