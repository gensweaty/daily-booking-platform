import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import { FileUploadField } from "../shared/FileUploadField";
import { useAuth } from "@/contexts/AuthContext";

interface EventFileUploadProps {
  eventId: string;
}

export const EventFileUpload = ({ eventId }: EventFileUploadProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const handleFileUpload = async () => {
    if (!selectedFile || !user) return;

    try {
      console.log("Uploading file for event:", eventId);
      const fileExt = selectedFile.name.split('.').pop();
      const filePath = `${crypto.randomUUID()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('event_attachments')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      console.log("File uploaded successfully, creating database record...");
      const { error: fileRecordError } = await supabase
        .from('event_files')
        .insert({
          event_id: eventId,
          filename: selectedFile.name,
          file_path: filePath,
          content_type: selectedFile.type,
          size: selectedFile.size,
          user_id: user.id
        });

      if (fileRecordError) throw fileRecordError;

      console.log("File record created successfully");
      await queryClient.invalidateQueries({ queryKey: ['eventFiles', eventId] });
      
      toast({
        title: "Success",
        description: "File uploaded successfully",
      });

      setSelectedFile(null);
    } catch (error: any) {
      console.error("Error uploading file:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to upload file",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <FileUploadField
        onFileChange={setSelectedFile}
        fileError={fileError}
        setFileError={setFileError}
      />
      {selectedFile && (
        <button
          onClick={handleFileUpload}
          className="w-full px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90"
        >
          Upload File
        </button>
      )}
    </div>
  );
};