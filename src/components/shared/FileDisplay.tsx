import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "../ui/button";
import { FileIcon, ImageIcon, ExternalLinkIcon } from "lucide-react";

interface FileDisplayProps {
  files: {
    id: string;
    filename: string;
    file_path: string;
    content_type: string;
  }[];
  bucketName: "task_attachments" | "note_attachments";
}

export const FileDisplay = ({ files, bucketName }: FileDisplayProps) => {
  const [loadingFile, setLoadingFile] = useState<string | null>(null);

  const handleFileClick = async (file: { file_path: string; filename: string }) => {
    try {
      setLoadingFile(file.file_path);
      const { data, error } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(file.file_path, 60); // URL valid for 60 seconds

      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (error) {
      console.error('Error downloading file:', error);
    } finally {
      setLoadingFile(null);
    }
  };

  const isImage = (contentType: string) => contentType.startsWith('image/');

  return (
    <div className="mt-4 space-y-4">
      <h3 className="font-semibold text-foreground">Attachments</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {files.map((file) => (
          <div
            key={file.id}
            className="border rounded-lg p-4 flex flex-col items-center space-y-2 bg-background"
          >
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
    </div>
  );
};