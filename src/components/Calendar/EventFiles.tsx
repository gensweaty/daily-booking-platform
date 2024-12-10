import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { FileDisplay } from "../shared/FileDisplay";
import { useToast } from "../ui/use-toast";

interface EventFilesProps {
  eventId: string;
}

export const EventFiles = ({ eventId }: EventFilesProps) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: files } = useQuery({
    queryKey: ['eventFiles', eventId],
    queryFn: async () => {
      if (!eventId) return [];
      console.log("Fetching files for event:", eventId);
      const { data, error } = await supabase
        .from('event_files')
        .select('*')
        .eq('event_id', eventId);
      
      if (error) {
        console.error("Error fetching files:", error);
        throw error;
      }
      console.log("Fetched files:", data);
      return data || [];
    },
    enabled: !!eventId,
  });

  const handleDeleteFile = async (fileId: string, filePath: string) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('event_attachments')
        .remove([filePath]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('event_files')
        .delete()
        .eq('id', fileId);

      if (dbError) throw dbError;

      // Invalidate queries
      await queryClient.invalidateQueries({ queryKey: ['eventFiles', eventId] });

      toast({
        title: "Success",
        description: "File deleted successfully",
      });
    } catch (error: any) {
      console.error('Error deleting file:', error);
      toast({
        title: "Error",
        description: "Failed to delete file",
        variant: "destructive",
      });
    }
  };

  if (!files || files.length === 0) return null;

  return (
    <div className="mt-4">
      <h3 className="text-sm font-medium mb-2">Attachments</h3>
      <FileDisplay 
        files={files} 
        bucketName="event_attachments" 
        onDelete={handleDeleteFile}
        allowDelete 
      />
    </div>
  );
};