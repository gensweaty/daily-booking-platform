import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { FileDisplay } from "../shared/FileDisplay";

interface EventFilesProps {
  eventId: string | undefined;
}

export const EventFiles = ({ eventId }: EventFilesProps) => {
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

  if (!files || files.length === 0) return null;

  return (
    <div className="mt-4">
      <h3 className="text-sm font-medium mb-2">Attachments</h3>
      <FileDisplay files={files} bucketName="event_attachments" allowDelete />
    </div>
  );
};