import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { FileIcon } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface EventFileDisplayProps {
  eventId: string;
}

export const EventFileDisplay = ({ eventId }: EventFileDisplayProps) => {
  const { toast } = useToast();
  const { data: files, isLoading, error } = useQuery({
    queryKey: ['eventFiles', eventId],
    queryFn: async () => {
      console.log('Fetching files for event:', eventId);
      const { data, error } = await supabase
        .from('event_files')
        .select('*')
        .eq('event_id', eventId);
      
      if (error) {
        console.error('Error fetching event files:', error);
        throw error;
      }
      console.log('Retrieved files:', data);
      return data || [];
    },
    enabled: !!eventId,
  });

  const handleFileClick = async (filePath: string) => {
    try {
      console.log('Opening file:', filePath);
      const { data, error } = await supabase.storage
        .from('event_attachments')
        .createSignedUrl(filePath, 60);

      if (error) {
        console.error('Error creating signed URL:', error);
        toast({
          title: "Error",
          description: "Failed to open file",
          variant: "destructive",
        });
        throw error;
      }
      
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (error) {
      console.error('Error opening file:', error);
      toast({
        title: "Error",
        description: "Failed to open file",
        variant: "destructive",
      });
    }
  };

  if (error) {
    return <div className="text-sm text-red-500">Error loading files</div>;
  }

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading files...</div>;
  }

  return (
    <div className="space-y-2">
      {files && files.length > 0 ? (
        files.map((file) => (
          <Button
            key={file.id}
            variant="outline"
            className="w-full text-left flex items-center gap-2"
            onClick={() => handleFileClick(file.file_path)}
          >
            <FileIcon className="h-4 w-4" />
            {file.filename}
          </Button>
        ))
      ) : (
        <div className="text-sm text-muted-foreground">No files uploaded</div>
      )}
    </div>
  );
};