
import { useState, useRef, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface FileUploadFieldProps {
  onChange: (file: File | null) => void;
  fileError: string;
  setFileError: (error: string) => void;
  hideLabel?: boolean;
  resetOnDialogClose?: boolean;
  dialogOpen?: boolean;
}

export const FileUploadField = ({
  onChange,
  fileError,
  setFileError,
  hideLabel = false,
  resetOnDialogClose = false,
  dialogOpen = true,
}: FileUploadFieldProps) => {
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useLanguage();

  // Effect to reset file input when dialog closes
  useEffect(() => {
    if (resetOnDialogClose && !dialogOpen) {
      setSelectedFileName(null);
      onChange(null);
      setFileError("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [dialogOpen, resetOnDialogClose, onChange, setFileError]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    
    if (file) {
      // Validate file size (5MB max)
      const maxSizeInBytes = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSizeInBytes) {
        setFileError(t("common.fileTooLarge"));
        setSelectedFileName(null);
        onChange(null);
        return;
      }
      
      // Validate file type
      const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];
      
      if (!allowedTypes.includes(file.type)) {
        setFileError(t("common.invalidFileType"));
        setSelectedFileName(null);
        onChange(null);
        return;
      }
      
      setSelectedFileName(file.name);
      onChange(file);
      setFileError("");
    } else {
      setSelectedFileName(null);
      onChange(null);
      setFileError("");
    }
  };

  const handleClearFile = () => {
    setSelectedFileName(null);
    onChange(null);
    setFileError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      {!hideLabel && (
        <Label htmlFor="file-upload" className="block text-sm font-medium text-gray-700">
          {t("common.uploadFile")}
        </Label>
      )}
      
      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Input
            ref={fileInputRef}
            id="file-upload"
            type="file"
            className={`w-full cursor-pointer ${
              selectedFileName ? "opacity-0 absolute" : ""
            }`}
            onChange={handleFileChange}
            accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx"
          />
          
          {selectedFileName && (
            <div className="flex items-center justify-between px-3 py-2 border rounded-md">
              <span className="truncate max-w-[200px]">{selectedFileName}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={handleClearFile}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
      
      {fileError && (
        <p className="text-sm text-red-500">{fileError}</p>
      )}
    </div>
  );
};
