import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { FileIcon, RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface EventFileDisplayProps {
  eventId: string;
}

export const EventFileDisplay = ({ eventId }: EventFileDisplayProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
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
          description: "Failed to open file. Please try again.",
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
        description: "Failed to open file. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleRetry = () => {
    queryClient.invalidateQueries({ queryKey: ['eventFiles', eventId] });
  };

  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-500">
        <span>Error loading files</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRetry}
          className="h-8 px-2"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
    );
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