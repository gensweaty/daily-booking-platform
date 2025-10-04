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
  fallbackBuckets?: string[]; // Add fallback buckets to try if the file is not found in the primary bucket
  // Permission props for sub-users
  currentUserName?: string;
  currentUserType?: string;
  isSubUser?: boolean;
}

export const FileDisplay = ({ 
  files, 
  bucketName, 
  allowDelete = false, 
  onFileDeleted,
  parentId,
  parentType,
  fallbackBuckets = [],
  currentUserName,
  currentUserType = 'admin',
  isSubUser = false
}: FileDisplayProps) => {
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const [fileURLs, setFileURLs] = useState<{[key: string]: string}>({});
  const [validatedBuckets, setValidatedBuckets] = useState<{[key: string]: string}>({});
  const [signedUrls, setSignedUrls] = useState<{[key: string]: string}>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  // Enhanced file signature function to better handle file deduplication
  const getFileSignature = (file: FileRecord): string => {
    const filePath = file.file_path || '';
    const filename = file.filename || '';
    const fileId = file.id || '';
    
    // Use all available identifiers to create a more robust signature
    return `${filename}:${filePath}:${fileId}`;
  };

  // Remove duplicate files using our enhanced signature
  const uniqueFiles = files.reduce((acc: FileRecord[], current) => {
    // Skip undefined or files without paths
    if (!current || !current.file_path) return acc;
    
    // Generate a unique signature for this file
    const signature = getFileSignature(current);
    const isDuplicate = acc.some(item => getFileSignature(item) === signature);
    
    if (!isDuplicate) {
      acc.push(current);
    }
    
    return acc;
  }, []);

  // Function to validate and generate signed URLs for file access
  const generateSignedUrl = async (bucket: string, filePath: string): Promise<string | null> => {
    try {
      const normalizedPath = normalizeFilePath(filePath);
      
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(normalizedPath, 300); // 5 minute signed URL for viewing/preview
      
      if (error || !data) {
        console.log(`Could not generate signed URL for ${bucket}:${normalizedPath}`, error);
        return null;
      }
      
      return data.signedUrl;
    } catch (error) {
      console.error(`Error generating signed URL for ${bucket}:${filePath}:`, error);
      return null;
    }
  };

  // Function to check file existence in a bucket
  const checkFileExistence = async (bucket: string, filePath: string): Promise<boolean> => {
    try {
      const normalizedPath = normalizeFilePath(filePath);
      
      // First try to get a signed URL - this will only work if the file exists
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(normalizedPath, 5); // Short 5 second signed URL just to check existence
      
      if (error || !data) {
        return false;
      }
      
      return true;
    } catch (error) {
      console.error(`Error checking file in ${bucket}:`, error);
      return false;
    }
  };

  useEffect(() => {
    // Debug the files we're trying to display
    console.log("FileDisplay - Files to process:", uniqueFiles);
    console.log("FileDisplay - Primary bucket:", bucketName);
    console.log("FileDisplay - Fallback buckets:", fallbackBuckets);
    
    const determineBucketsAndUrls = async () => {
      const newURLs: {[key: string]: string} = {};
      const newBuckets: {[key: string]: string} = {};
      const newSignedUrls: {[key: string]: string} = {};
      
      // Enhanced bucket search - add 'customer_attachments' to fallbacks for better file finding
      const allPossibleBuckets = [
        bucketName, 
        ...fallbackBuckets, 
        'customer_attachments', 
        'event_attachments',
        'booking_attachments'
      ];
      
      for (const file of uniqueFiles) {
        if (!file.file_path) continue;
        
        const normalizedPath = normalizeFilePath(file.file_path);
        let foundBucket = null;
        
        // First try the hint from parentType if available
        const hintBucket = file.parentType === 'customer' ? 'customer_attachments' : 
                          file.parentType === 'event' ? 'event_attachments' : null;
        
        // Create a prioritized bucket list, starting with the hint if available
        const bucketSearchOrder = hintBucket ? 
          [hintBucket, ...allPossibleBuckets.filter(b => b !== hintBucket)] : 
          allPossibleBuckets;
        
        // Search through all possible buckets in priority order
        for (const bucket of bucketSearchOrder) {
          console.log(`Checking if file ${file.filename} exists in ${bucket} at ${normalizedPath}`);
          const exists = await checkFileExistence(bucket, normalizedPath);
          
          if (exists) {
            foundBucket = bucket;
            console.log(`File found in ${bucket}`);
            
            // Generate a signed URL for immediate use
            const signedUrl = await generateSignedUrl(bucket, normalizedPath);
            if (signedUrl) {
              newSignedUrls[file.id] = signedUrl;
            }
            
            break;
          }
        }
        
        // If we found a bucket where the file exists, use it
        if (foundBucket) {
          newBuckets[file.id] = foundBucket;
          // Still store the direct URL as a fallback
          newURLs[file.id] = `${getStorageUrl()}/object/public/${foundBucket}/${normalizedPath}`;
        } else {
          // If we didn't find the file in any bucket, default to the primary
          console.log(`File not found in any bucket, defaulting to ${bucketName}`);
          newBuckets[file.id] = bucketName;
          newURLs[file.id] = `${getStorageUrl()}/object/public/${bucketName}/${normalizedPath}`;
        }
      }
      
      setValidatedBuckets(newBuckets);
      setFileURLs(newURLs);
      setSignedUrls(newSignedUrls);
    };
    
    determineBucketsAndUrls();
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
      // Use the validated bucket for this file
      const effectiveBucket = validatedBuckets[fileId] || bucketName;
      console.log(`Attempting to download file: ${fileName}, path: ${filePath}, fileId: ${fileId}, bucket: ${effectiveBucket}`);
      
      const normalizedPath = normalizeFilePath(filePath);
      
      // Generate a signed URL instead of using direct URL
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from(effectiveBucket)
        .createSignedUrl(normalizedPath, 60); // 1 minute expiry
      
      if (signedUrlError || !signedUrlData?.signedUrl) {
        console.error("Error generating signed URL:", signedUrlError);
        throw new Error("Failed to generate download URL");
      }
      
      const directUrl = signedUrlData.signedUrl;
      console.log('Using signed URL for download:', directUrl);
      
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
      a.download = fileName; // Set download attribute
      a.style.display = 'none'; // Hide the element
      
      // Add to DOM, trigger click, and clean up
      document.body.appendChild(a);
      a.click();
      
      // Remove element and revoke blob URL after a delay
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl); // Important: free up memory
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

  // Always use signed URLs for file operations
  const getDisplayUrl = (filePath: string, fileId: string): string => {
    // First try to use a pre-generated signed URL
    if (signedUrls[fileId]) {
      return signedUrls[fileId];
    }
    
    // Fall back to direct URL if no signed URL is available
    const effectiveBucket = validatedBuckets[fileId] || bucketName;
    const normalizedPath = normalizeFilePath(filePath);
    return `${getStorageUrl()}/object/public/${effectiveBucket}/${normalizedPath}`;
  };

  const handleOpenFile = async (filePath: string, fileId: string) => {
    try {
      if (!filePath) {
        throw new Error('File path is missing');
      }
      
      // Generate a fresh signed URL with longer expiry for viewing
      const effectiveBucket = validatedBuckets[fileId] || bucketName;
      const normalizedPath = normalizeFilePath(filePath);
      
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from(effectiveBucket)
        .createSignedUrl(normalizedPath, 3600); // 1 hour expiry for viewing
      
      if (signedUrlError || !signedUrlData?.signedUrl) {
        console.error("Error generating signed URL for viewing:", signedUrlError);
        throw new Error("Failed to generate file URL");
      }
      
      const directUrl = signedUrlData.signedUrl;
      console.log('Opening file with signed URL:', directUrl);
      
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
      
      // Use the validated bucket for this file
      const effectiveBucket = validatedBuckets[fileId] || bucketName;
      console.log(`Deleting file from bucket ${effectiveBucket}, path: ${filePath}`);
      
      const { error: storageError } = await supabase.storage
        .from(effectiveBucket)
        .remove([normalizeFilePath(filePath)]);

      if (storageError) {
        console.error('Error deleting file from storage:', storageError);
        throw storageError;
      }
      
      // Determine the appropriate table name based on the parent type
      let tableName: "files" | "customer_files_new" | "note_files" | "event_files";
      
      if (parentType === 'event') {
        tableName = "event_files";
      } else if (parentType === 'customer') {
        tableName = "customer_files_new";
      } else if (parentType === 'note') {
        tableName = "note_files";
      } else if (parentType === 'task') {
        tableName = "files";  // Task files are stored in the "files" table
      } else {
        // Default to customer_files_new if we can't determine
        tableName = "customer_files_new";
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
      
      if (onFileDeleted) {
        onFileDeleted(fileId);
      }
      
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
      return false; // Conservative: sub-users can't delete task files for now
    } else if (parentType === 'event') {
      // For events, sub-users should not be able to delete files uploaded by admin users
      return false; // Conservative: sub-users can't delete event files for now
    } else if (parentType === 'customer') {
      // For customers, sub-users should not be able to delete files uploaded by admin users
      return false; // Conservative: sub-users can't delete customer files for now
    }
    
    // For other types (note), allow deletion
    return true;
  };

  if (!uniqueFiles || uniqueFiles.length === 0) {
    return null;
  }

  // Display a compact layout for an inline view that shows just the filename
  // with an expandable view for more options
  return (
    <div className="space-y-2">
      {uniqueFiles.map((file) => {
        if (!file.file_path) return null;
        
        const fileNameDisplay = file.filename && file.filename.length > 20 
          ? file.filename.substring(0, 20) + '...' 
          : file.filename;
          
        // Get display URL (preferably signed URL)
        const imageUrl = getDisplayUrl(file.file_path, file.id);
          
        console.log(`Rendering file: ${file.filename}, URL: ${imageUrl}`);
          
        return (
          <div key={file.id} className="flex flex-col bg-background border rounded-md overflow-hidden">
            <div className="p-3 flex items-center justify-between">
              <div className="flex items-center space-x-2 overflow-hidden">
                {/* Use a proper thumbnail with fallback for images */}
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
                {canDeleteFile(file) && (
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
