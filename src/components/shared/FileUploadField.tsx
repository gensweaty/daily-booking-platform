
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { useState, useEffect, forwardRef } from "react";
import { LanguageText } from "./LanguageText";

const MAX_FILE_SIZE_DOCS = 1024 * 1024; // 1MB
const MAX_FILE_SIZE_IMAGES = 50 * 1024 * 1024; // 50MB for images
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const ALLOWED_DOC_TYPES = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
"application/vnd.openxmlformats-officedocument.presentationml.presentation"];

interface FileUploadFieldProps {
  onChange?: (file: File | null) => void;
  onUpload?: (url: string) => void;
  onFileSelect?: (file: File) => Promise<void> | void;
  onFileChange?: (file: File | null) => void;
  fileError?: string;
  setFileError?: (error: string) => void;
  acceptedFileTypes?: string;
  hideLabel?: boolean;
  hideDescription?: boolean;
  disabled?: boolean;
  imageUrl?: string;
  bucket?: string;
  uploadText?: string;
  chooseFileText?: string;
  noFileText?: string;
  maxSizeMB?: number;
  selectedFile?: File | null;
  isUploading?: boolean;
}

export const FileUploadField = forwardRef<HTMLInputElement, FileUploadFieldProps>(({
  onChange,
  onUpload,
  onFileChange,
  onFileSelect,
  fileError,
  setFileError,
  acceptedFileTypes = ".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx,.txt",
  hideLabel = false,
  hideDescription = false,
  disabled = false,
  imageUrl,
  bucket,
  uploadText,
  chooseFileText,
  noFileText,
  maxSizeMB,
  selectedFile,
  isUploading = false
}, ref) => {
  const { t } = useLanguage();
  const [localSelectedFile, setLocalSelectedFile] = useState<File | null>(selectedFile || null);
  const [localError, setLocalError] = useState<string>("");

  const displayedFile = selectedFile || localSelectedFile;
  const displayedError = fileError || localError;
  const displayedSetError = setFileError || setLocalError;

  useEffect(() => {
    if (selectedFile !== undefined) {
      setLocalSelectedFile(selectedFile);
    }
  }, [selectedFile]);

  const validateFile = (file: File): boolean => {
    console.log('🔍 FileUploadField - Validating file:', file.name, 'Type:', file.type, 'Size:', file.size);
    
    const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
    const isDoc = ALLOWED_DOC_TYPES.includes(file.type);
    
    if (!isImage && !isDoc) {
      console.log('❌ FileUploadField - Invalid file type:', file.type);
      displayedSetError("Please select a valid file type (PDF, DOC, DOCX, XLS, XLSX, JPG, PNG)");
      return false;
    }
    
    const maxSize = isImage ? MAX_FILE_SIZE_IMAGES : MAX_FILE_SIZE_DOCS;
    if (file.size > maxSize) {
      const maxSizeMB = maxSize / (1024 * 1024);
      console.log('❌ FileUploadField - File too large:', file.size, 'Max:', maxSize);
      displayedSetError(`File size must be less than ${maxSizeMB}MB`);
      return false;
    }
    
    console.log('✅ FileUploadField - File validation passed');
    return true;
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    
    console.log('📁 FileUploadField - File selected:', file?.name);
    
    if (!file) {
      console.log('📁 FileUploadField - No file selected, clearing state');
      setLocalSelectedFile(null);
      onChange?.(null);
      onFileChange?.(null);
      displayedSetError("");
      return;
    }

    if (!validateFile(file)) {
      console.log('❌ FileUploadField - File validation failed');
      setLocalSelectedFile(null);
      onChange?.(null);
      onFileChange?.(null);
      return;
    }

    console.log('✅ FileUploadField - File validation passed, updating state');
    displayedSetError("");
    setLocalSelectedFile(file);
    
    // Call all the callback functions
    onChange?.(file);
    onFileChange?.(file);
    
    if (onFileSelect) {
      try {
        console.log('📁 FileUploadField - Calling onFileSelect callback');
        await onFileSelect(file);
        console.log('✅ FileUploadField - onFileSelect completed successfully');
      } catch (error) {
        console.error('❌ FileUploadField - Error in onFileSelect:', error);
        displayedSetError("Error processing file");
      }
    }
  };

  return (
    <div className="space-y-2">
      {!hideLabel && (
        <label className="block text-sm font-medium text-gray-700">
          <LanguageText>{t("common.attachments")}</LanguageText>
        </label>
      )}
      
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-gray-400 transition-colors">
        <Input
          ref={ref}
          type="file"
          onChange={handleFileChange}
          accept={acceptedFileTypes}
          disabled={disabled || isUploading}
          className="hidden"
          id="file-upload"
        />
        
        <label 
          htmlFor="file-upload" 
          className="cursor-pointer block"
        >
          {displayedFile ? (
            <div className="text-sm text-gray-600">
              <p className="font-medium">{displayedFile.name}</p>
              <p className="text-xs text-gray-500">
                {(displayedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          ) : (
            <div className="text-sm text-gray-500">
              <p className="font-medium">
                {chooseFileText || (
                  <LanguageText>{t("common.chooseFile")}</LanguageText>
                )}
              </p>
              {!hideDescription && (
                <p className="text-xs">
                  <LanguageText>{t("common.supportedFormats")}</LanguageText>: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG
                </p>
              )}
            </div>
          )}
        </label>
      </div>

      {displayedError && (
        <p className="text-sm text-red-600">{displayedError}</p>
      )}
      
      {isUploading && (
        <p className="text-sm text-blue-600">
          <LanguageText>{t("common.uploading")}</LanguageText>...
        </p>
      )}
    </div>
  );
});

FileUploadField.displayName = "FileUploadField";
