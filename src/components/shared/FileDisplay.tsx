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
  bucketName: "task_attachments" | "note_attachments" | "event_attachments";
  allowDelete?: boolean;
  onFileDeleted?: (fileId: string) => void;
}

export const FileDisplay = ({ files, bucketName, allowDelete = false, onFileDeleted }: FileDisplayProps) => {
  const [loadingFile, setLoadingFile] = useState<string | null>(null);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleFileClick = async (file: { file_path: string; filename: string }) => {
    try {
      setLoadingFile(file.file_path);
      const { data, error } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(file.file_path, 60);

      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({
        title: "Error",
        description: "Failed to download file",
        variant: "destructive",
      });
    } finally {
      setLoadingFile(null);
    }
  };

  const handleDeleteFile = async (file: { id: string; file_path: string }) => {
    try {
      setDeletingFile(file.id);
      
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from(bucketName)
        .remove([file.file_path]);

      if (storageError) throw storageError;

      // Delete from database based on bucket type
      const tableName = bucketName === 'event_attachments' ? 'event_files' : 
                       bucketName === 'note_attachments' ? 'note_files' : 'files';
                       
      const { error: dbError } = await supabase
        .from(tableName)
        .delete()
        .eq('id', file.id);

      if (dbError) throw dbError;

      // Invalidate relevant queries
      await queryClient.invalidateQueries({ queryKey: ['eventFiles'] });
      await queryClient.invalidateQueries({ queryKey: ['noteFiles'] });
      await queryClient.invalidateQueries({ queryKey: ['taskFiles'] });

      if (onFileDeleted) {
        onFileDeleted(file.id);
      }

      toast({
        title: "Success",
        description: "File deleted successfully",
      });
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

  const getImageUrl = (file: { file_path: string }) => {
    console.log('Getting image URL for bucket:', bucketName, 'file path:', file.file_path);
    const { data } = supabase.storage
      .from(bucketName)
      .getPublicUrl(file.file_path);
    console.log('Generated public URL:', data.publicUrl);
    return data.publicUrl;
  };

  const isImage = (contentType: string) => contentType.startsWith('image/');

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4 max-h-[50vh] overflow-y-auto p-2">
      {files.map((file) => (
        <div
          key={file.id}
          className="relative flex flex-col items-center space-y-2 p-2 sm:p-4 border rounded-lg bg-background group"
        >
          {allowDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => handleDeleteFile(file)}
              disabled={deletingFile === file.id}
            >
              <XIcon className="h-4 w-4" />
            </Button>
          )}
          <div className="w-full aspect-square flex items-center justify-center bg-muted rounded-md overflow-hidden">
            {isImage(file.content_type) ? (
              <img
                src={getImageUrl(file)}
                alt={file.filename}
                className="w-full h-full object-contain max-h-[200px] sm:max-h-[300px]"
                onError={(e) => {
                  console.error('Image load error:', e);
                  e.currentTarget.src = '/placeholder.svg';
                }}
              />
            ) : (
              <FileIcon className="w-8 h-8 sm:w-12 sm:h-12 text-muted-foreground" />
            )}
          </div>
          <p className="text-xs sm:text-sm text-center text-foreground truncate w-full">
            {file.filename}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs sm:text-sm py-1 px-2 h-auto"
            onClick={() => handleFileClick(file)}
            disabled={loadingFile === file.file_path}
          >
            {loadingFile === file.file_path ? (
              "Loading..."
            ) : (
              <>
                <ExternalLinkIcon className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                Open
              </>
            )}
          </Button>
        </div>
      ))}
    </div>
  );
};