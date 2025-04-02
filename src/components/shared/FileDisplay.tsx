import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "../ui/button";
import { FileIcon, ExternalLinkIcon, XIcon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "../ui/use-toast";
import { AspectRatio } from "../ui/aspect-ratio";

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

  const getEffectiveBuckets = (file_path: string) => {
    if (bucketName === 'customer_attachments') {
      return ['customer_attachments', 'event_attachments'];
    }
    if (bucketName === 'event_attachments') {
      return ['event_attachments', 'customer_attachments'];
    }
    return [bucketName];
  };

  const tryGetSignedUrl = async (bucket: string, filePath: string) => {
    try {
      console.log(`Attempting to get signed URL from bucket: ${bucket} for file: ${filePath}`);
      
      const { data: existsData, error: existsError } = await supabase.storage
        .from(bucket)
        .list('', {
          search: filePath,
          limit: 1
        });

      if (existsError) {
        console.error(`Error checking file existence in ${bucket}:`, existsError);
        return null;
      }

      if (!existsData?.length) {
        console.log(`File not found in bucket ${bucket}`);
        return null;
      }

      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(filePath, 3600);

      if (error) {
        console.error(`Error getting signed URL from ${bucket}:`, error);
        return null;
      }

      console.log(`Successfully got signed URL from ${bucket}`);
      return data.signedUrl;
    } catch (error) {
      console.error(`Exception getting signed URL from ${bucket}:`, error);
      return null;
    }
  };

  const handleFileClick = async (file: { file_path: string; filename: string }) => {
    try {
      setLoadingFile(file.file_path);
      const buckets = getEffectiveBuckets(file.file_path);
      let signedUrl = null;
      let successBucket = null;

      for (const bucket of buckets) {
        signedUrl = await tryGetSignedUrl(bucket, file.file_path);
        if (signedUrl) {
          successBucket = bucket;
          break;
        }
      }

      if (signedUrl) {
        console.log(`Successfully found file in bucket: ${successBucket}`);
        window.open(signedUrl, '_blank');
      } else {
        throw new Error('File not found in any bucket');
      }
    } catch (error: any) {
      console.error('Error opening file:', error);
      toast({
        title: "Error",
        description: "Failed to open file. The file might have been moved or deleted.",
        variant: "destructive",
      });
    } finally {
      setLoadingFile(null);
    }
  };

  const handleDeleteFile = async (file: { id: string; file_path: string }) => {
    try {
      setDeletingFile(file.id);
      const buckets = getEffectiveBuckets(file.file_path);
      let deleteSuccess = false;

      // First delete from storage
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

      if (!deleteSuccess) {
        throw new Error('Failed to delete file from storage');
      }

      // Delete from all relevant tables to ensure complete cleanup
      const deletePromises = [
        supabase
          .from('event_files')
          .delete()
          .eq('file_path', file.file_path),
        supabase
          .from('customer_files_new')
          .delete()
          .eq('file_path', file.file_path)
      ];

      await Promise.all(deletePromises);

      if (onFileDeleted) {
        onFileDeleted(file.id);
      }

      // Invalidate all relevant queries
      await queryClient.invalidateQueries({ queryKey: ['customerFiles'] });
      await queryClient.invalidateQueries({ queryKey: ['eventFiles'] });

      toast({
        title: "Success",
        description: "File deleted successfully",
      });
    } catch (error: any) {
      console.error('Error deleting file:', error);
      toast({
        title: "Error",
        description: "Failed to delete file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeletingFile(null);
    }
  };

  const loadImageUrl = async (file_path: string) => {
    if (!imageUrls[file_path]) {
      try {
        const buckets = getEffectiveBuckets(file_path);
        let signedUrl = null;

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
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-1.5 w-full p-1">
      {files.map((file) => (
        <div
          key={file.id}
          className="relative flex flex-col items-center space-y-0.5 p-1 border rounded-lg bg-background group min-w-[80px] max-w-[120px] w-full mx-auto"
        >
          {allowDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute -right-1 -top-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => handleDeleteFile(file)}
              disabled={deletingFile === file.id}
            >
              <XIcon className="h-2.5 w-2.5" />
            </Button>
          )}
          <div 
            className="w-full aspect-square flex items-center justify-center bg-muted rounded-md overflow-hidden cursor-pointer"
            onClick={() => handleFileClick(file)}
          >
            <AspectRatio ratio={1} className="w-full h-full">
              {isImage(file.filename) ? (
                <img
                  src={imageUrls[file.file_path] || '/placeholder.svg'}
                  alt={file.filename}
                  className="w-full h-full object-cover"
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
                <div className="w-full h-full flex items-center justify-center">
                  <FileIcon className="w-6 h-6 text-muted-foreground" />
                </div>
              )}
            </AspectRatio>
          </div>
          <p className="text-[10px] text-center text-foreground truncate w-full px-0.5">
            {file.filename}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="w-full text-[10px] py-0.5 px-1.5 h-5 min-h-0"
            onClick={() => handleFileClick(file)}
            disabled={loadingFile === file.file_path}
          >
            {loadingFile === file.file_path ? (
              "Loading..."
            ) : (
              <>
                <ExternalLinkIcon className="w-2.5 h-2.5 mr-0.5" />
                Open
              </>
            )}
          </Button>
        </div>
      ))}
    </div>
  );
};
