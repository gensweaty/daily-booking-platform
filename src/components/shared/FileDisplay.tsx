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
          search: filePath
        });

      if (existsError || !existsData?.length) {
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
        description: "Failed to delete file. Please try again.",
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
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-w-full overflow-x-auto p-2">
      {files.map((file) => (
        <div
          key={file.id}
          className="relative flex flex-col items-center space-y-1 p-1.5 border rounded-lg bg-background group w-[100px]"
        >
          {allowDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute -right-1 -top-1 h-6 w-6 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => handleDeleteFile(file)}
              disabled={deletingFile === file.id}
            >
              <XIcon className="h-3 w-3" />
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
                  <FileIcon className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
            </AspectRatio>
          </div>
          <p className="text-xs text-center text-foreground truncate w-full">
            {file.filename}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs py-0.5 px-2 h-6"
            onClick={() => handleFileClick(file)}
            disabled={loadingFile === file.file_path}
          >
            {loadingFile === file.file_path ? (
              "Loading..."
            ) : (
              <>
                <ExternalLinkIcon className="w-3 h-3 mr-1" />
                Open
              </>
            )}
          </Button>
        </div>
      ))}
    </div>
  );
};
