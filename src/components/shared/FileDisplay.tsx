import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "../ui/button";
import { FileIcon, ImageIcon, ExternalLinkIcon, XIcon } from "lucide-react";
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
}

export const FileDisplay = ({ files, bucketName, allowDelete = false }: FileDisplayProps) => {
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

      // Delete from database
      const tableName = bucketName === 'task_attachments' ? 'files' : 
                       bucketName === 'note_attachments' ? 'note_files' : 
                       'event_files';
      
      const { error: dbError } = await supabase
        .from(tableName)
        .delete()
        .eq('id', file.id);

      if (dbError) throw dbError;

      // Invalidate queries
      await queryClient.invalidateQueries({ queryKey: ['taskFiles'] });
      await queryClient.invalidateQueries({ queryKey: ['noteFiles'] });
      await queryClient.invalidateQueries({ queryKey: ['eventFiles'] });

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

  const isImage = (contentType: string) => contentType.startsWith('image/');

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      {files.map((file) => (
        <div
          key={file.id}
          className="relative border rounded-lg p-4 flex flex-col items-center space-y-2 bg-background group"
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
          {isImage(file.content_type) ? (
            <div className="relative w-full aspect-square">
              <img
                src={`${supabase.storage.from(bucketName).getPublicUrl(file.file_path).data.publicUrl}`}
                alt={file.filename}
                className="rounded-md object-cover w-full h-full"
              />
            </div>
          ) : (
            <FileIcon className="w-12 h-12 text-muted-foreground" />
          )}
          <p className="text-sm text-center text-foreground truncate w-full">
            {file.filename}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => handleFileClick(file)}
            disabled={loadingFile === file.file_path}
          >
            {loadingFile === file.file_path ? (
              "Loading..."
            ) : (
              <>
                <ExternalLinkIcon className="w-4 h-4 mr-2" />
                Open
              </>
            )}
          </Button>
        </div>
      ))}
    </div>
  );
};