
import { useState, ChangeEvent } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

interface FileUploadFieldProps {
  onChange: (file: File | null) => void;
  fileError: string;
  setFileError: (error: string) => void;
  hideLabel?: boolean;
  maxSizeMB?: number; // Max file size in MB
  allowedTypes?: string[]; // Array of allowed MIME types
}

export const FileUploadField = ({ 
  onChange, 
  fileError, 
  setFileError, 
  hideLabel = false,
  maxSizeMB = 5, // Default max size is 5MB
  allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'] 
}: FileUploadFieldProps) => {
  const [selectedFileName, setSelectedFileName] = useState("");
  const { t } = useLanguage();

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;

    if (!files || files.length === 0) {
      setSelectedFileName("");
      onChange(null);
      return;
    }

    const file = files[0];
    console.log("Selected file:", file.name, file.type, file.size);

    // Validate file type
    if (allowedTypes && allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
      console.error("Invalid file type:", file.type);
      setFileError(t("files.invalidType"));
      setSelectedFileName("");
      onChange(null);
      return;
    }

    // Validate file size
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      console.error("File too large:", file.size, "max:", maxSizeBytes);
      setFileError(`${t("files.tooLarge")} (${maxSizeMB}MB)`);
      setSelectedFileName("");
      onChange(null);
      return;
    }

    setFileError("");
    setSelectedFileName(file.name);
    onChange(file);
    console.log("File successfully processed:", file.name);
  };

  return (
    <div className="space-y-2">
      {!hideLabel && <Label htmlFor="file-upload">{t("calendar.attachment")}</Label>}
      
      <div className="flex flex-col gap-2">
        <Input
          type="file"
          id="file-upload"
          onChange={handleFileChange}
          className="hidden"
          accept={allowedTypes.join(',')}
        />
        <div className="flex gap-2 items-center">
          <Button
            type="button"
            variant="secondary"
            className="w-full h-9"
            onClick={() => document.getElementById("file-upload")?.click()}
          >
            {t("calendar.chooseFile")}
          </Button>
          <span className={`text-sm ${selectedFileName ? 'text-primary' : 'text-muted-foreground'} overflow-hidden overflow-ellipsis whitespace-nowrap max-w-[200px]`}>
            {selectedFileName || t("calendar.noFileSelected")}
          </span>
        </div>
        {fileError && <p className="text-red-500 text-xs">{fileError}</p>}
      </div>
    </div>
  );
};
