import { useState } from "react";
import { CalendarEventType } from "@/lib/types/calendar";
import { uploadEventFile, validateFile } from "@/utils/fileOperations";
import { useToast } from "@/components/ui/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface EventFormHandlerProps {
  onSubmit: (data: Partial<CalendarEventType>) => Promise<CalendarEventType | undefined>;
  onSuccess: () => void;
  selectedFile: File | null;
  setFileError: (error: string) => void;
  eventData: Partial<CalendarEventType>;
}

export const useEventFormHandler = ({
  onSubmit,
  onSuccess,
  selectedFile,
  setFileError,
  eventData,
}: EventFormHandlerProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    let uploadedFilePath: string | null = null;

    try {
      if (selectedFile) {
        const fileError = validateFile(selectedFile);
        if (fileError) {
          setFileError(fileError);
          return;
        }
      }

      console.log('Submitting event with data:', eventData);
      const result = await onSubmit(eventData);

      if (selectedFile && result?.id) {
        console.log('Starting file upload for event:', result.id);
        uploadedFilePath = await uploadEventFile(selectedFile, result.id);
        
        // Invalidate the files query to trigger a refresh
        await queryClient.invalidateQueries({ queryKey: ['eventFiles', result.id] });
      }

      toast({
        title: "Success",
        description: `Event "${eventData.title}" was successfully saved.`,
      });
      
      onSuccess();
    } catch (error: any) {
      console.error('Error in handleSubmit:', error);
      
      toast({
        title: "Error Saving Event",
        description: error.message || "An unknown error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    handleSubmit,
    isSubmitting
  };
};