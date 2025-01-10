import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "../ui/button";
import { FileIcon, ExternalLinkIcon, XIcon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "../ui/use-toast";

interface FileDisplayProps {
  files: {
    id: string;
    filename: string;
    file_path: string;
    content_type: string;
  }[];
  bucketName: "task_attachments" | "note_attachments" | "event_attachments" | "customer_attachments";
  allowDelete?: boolean;
  onFileDeleted?: (fileId: string) => void;
}

export const FileDisplay = ({ files, bucketName, allowDelete = false, onFileDeleted }: FileDisplayProps) => {
  const [loadingFile, setLoadingFile] = useState<string | null>(null);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const getEffectiveBucket = (file_path: string) => {
    // For customer-related files, try both buckets
    if (bucketName === 'customer_attachments') {
      return ['customer_attachments', 'event_attachments'];
    }
    // For other files, just use the specified bucket
    return [bucketName];
  };

  const tryGetSignedUrl = async (bucket: string, filePath: string) => {
    try {
      console.log(`Attempting to get signed URL from bucket: ${bucket} for file: ${filePath}`);
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(filePath, 3600);

      if (error) {
        console.error(`Error getting signed URL from ${bucket}:`, error);
        return null;
      }

      return data.signedUrl;
    } catch (error) {
      console.error(`Exception getting signed URL from ${bucket}:`, error);
      return null;
    }
  };

  const handleFileClick = async (file: { file_path: string; filename: string }) => {
    try {
      setLoadingFile(file.file_path);
      const buckets = getEffectiveBucket(file.file_path);
      let signedUrl = null;

      // Try each bucket in sequence until we get a valid URL
      for (const bucket of buckets) {
        signedUrl = await tryGetSignedUrl(bucket, file.file_path);
        if (signedUrl) {
          console.log(`Successfully found file in bucket: ${bucket}`);
          break;
        }
      }

      if (signedUrl) {
        window.open(signedUrl, '_blank');
      } else {
        throw new Error('Could not generate signed URL from any bucket');
      }
    } catch (error: any) {
      console.error('Error opening file:', error);
      toast({
        title: "Error",
        description: "Failed to open file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingFile(null);
    }
  };

  const handleDeleteFile = async (file: { id: string; file_path: string }) => {
    try {
      setDeletingFile(file.id);
      const buckets = getEffectiveBucket(file.file_path);
      let deleteSuccess = false;

      // Try to delete from each potential bucket
      for (const bucket of buckets) {
        const { error } = await supabase.storage
          .from(bucket)
          .remove([file.file_path]);

        if (!error) {
          deleteSuccess = true;
          break;
        }
        console.log(`Failed to delete from ${bucket}, trying next bucket if available`);
      }

      if (deleteSuccess) {
        await handleDatabaseDelete(file.id);
      } else {
        throw new Error('Failed to delete file from any bucket');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      toast({
        title: "Error",
        description: "Failed to delete file",
        variant: "destructive",
      });
    } finally {
      setDeletingFile(null);
    }
  };

  const handleDatabaseDelete = async (fileId: string) => {
    const tableName = bucketName === 'event_attachments' ? 'event_files' : 
                     bucketName === 'note_attachments' ? 'note_files' : 
                     bucketName === 'customer_attachments' ? 'customer_files' : 'files';
                     
    const { error: dbError } = await supabase
      .from(tableName)
      .delete()
      .eq('id', fileId);

    if (dbError) throw dbError;

    // Invalidate all relevant queries
    await queryClient.invalidateQueries({ queryKey: ['eventFiles'] });
    await queryClient.invalidateQueries({ queryKey: ['noteFiles'] });
    await queryClient.invalidateQueries({ queryKey: ['taskFiles'] });
    await queryClient.invalidateQueries({ queryKey: ['customerFiles'] });
    await queryClient.invalidateQueries({ queryKey: ['customers'] });
    await queryClient.invalidateQueries({ queryKey: ['events'] });

    if (onFileDeleted) {
      onFileDeleted(fileId);
    }

    toast({
      title: "Success",
      description: "File deleted successfully",
    });
  };

  const loadImageUrl = async (file_path: string) => {
    if (!imageUrls[file_path]) {
      try {
        const buckets = getEffectiveBucket(file_path);
        let signedUrl = null;

        // Try each bucket until we get a valid URL
        for (const bucket of buckets) {
          const url = await tryGetSignedUrl(bucket, file_path);
          if (url) {
            signedUrl = url;
            break;
          }
        }

        if (signedUrl) {
          setImageUrls(prev => ({
            ...prev,
            [file_path]: signedUrl
          }));
          return signedUrl;
        }
      } catch (error) {
        console.error('Error loading image URL:', error);
      }
    }
    return imageUrls[file_path] || '/placeholder.svg';
  };

  const isImage = (filename: string) => {
    return filename.match(/\.(jpg|jpeg|png|gif|webp)$/i) !== null;
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1 sm:gap-4 max-h-[35vh] sm:max-h-[50vh] overflow-y-auto p-1 sm:p-2">
      {files.map((file) => (
        <div
          key={file.id}
          className="relative flex flex-col items-center space-y-1 sm:space-y-2 p-1 sm:p-4 border rounded-lg bg-background group"
        >
          {allowDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute -right-1 -top-1 sm:-right-2 sm:-top-2 h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => handleDeleteFile(file)}
              disabled={deletingFile === file.id}
            >
              <XIcon className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
          )}
          <div 
            className="w-full aspect-square flex items-center justify-center bg-muted rounded-md overflow-hidden cursor-pointer"
            onClick={() => handleFileClick(file)}
          >
            {isImage(file.filename) ? (
              <img
                src={imageUrls[file.file_path] || '/placeholder.svg'}
                alt={file.filename}
                className="w-full h-full object-contain max-h-[150px] sm:max-h-[200px] md:max-h-[300px]"
                onError={(e) => {
                  console.error('Image load error:', e);
                  e.currentTarget.src = '/placeholder.svg';
                }}
                onLoad={async () => {
                  if (!imageUrls[file.file_path]) {
                    await loadImageUrl(file.file_path);
                  }
                }}
              />
            ) : (
              <FileIcon className="w-6 h-6 sm:w-8 sm:h-8 md:w-12 md:h-12 text-muted-foreground" />
            )}
          </div>
          <p className="text-[10px] sm:text-xs md:text-sm text-center text-foreground truncate w-full">
            {file.filename}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="w-full text-[10px] sm:text-xs md:text-sm py-0.5 sm:py-1 px-1 sm:px-2 h-6 sm:h-auto"
            onClick={() => handleFileClick(file)}
            disabled={loadingFile === file.file_path}
          >
            {loadingFile === file.file_path ? (
              "Loading..."
            ) : (
              <>
                <ExternalLinkIcon className="w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-4 md:h-4 mr-0.5 sm:mr-1 md:mr-2" />
                Open
              </>
            )}
          </Button>
        </div>
      ))}
    </div>
  );
};
