
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { useState, useEffect, forwardRef } from "react";
import { LanguageText } from "./LanguageText";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB for all files
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const ALLOWED_DOC_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.openxmlformats-officedocument.presentationml.presentation" // .pptx
];
const ALLOWED_AUDIO_TYPES = [
  "audio/mpeg", // .mp3
  "audio/mp3", // .mp3 (alternative)
  "audio/webm", // .webm
  "audio/wav", // .wav
  "audio/x-wav", // .wav (alternative)
  "audio/m4a", // .m4a
  "audio/x-m4a", // .m4a (alternative)
  "audio/ogg", // .ogg
  "video/webm" // .webm (can contain audio-only recordings)
];

interface FileUploadFieldProps {
  onChange?: (file: File | null) => void;
  onUpload?: (url: string) => void;
  onFileSelect?: (file: File) => Promise<void> | void; // Added this prop to match how it's being used
  onFileChange?: (file: File | null) => void; // For backward compatibility
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
  isUploading?: boolean; // Added to support the isUploading prop being passed from BusinessProfileForm
}

export const FileUploadField = forwardRef<HTMLInputElement, FileUploadFieldProps>(({
  onChange,
  onUpload,
  onFileChange,
  onFileSelect,
  fileError = "",
  setFileError = () => {},
  acceptedFileTypes,
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
  isUploading
}, ref) => {
  const { t, language } = useLanguage();
  const [localFileError, setLocalFileError] = useState("");
  const [fileSelected, setFileSelected] = useState<string>("");

  // Use either provided error state or local state if not provided
  const actualFileError = fileError || localFileError;
  const actualSetFileError = setFileError || setLocalFileError;

  // Update fileSelected state when selectedFile prop changes
  useEffect(() => {
    if (selectedFile) {
      setFileSelected(selectedFile.name);
    } else {
      setFileSelected("");
    }
  }, [selectedFile]);
  
  const validateFile = (file: File) => {
    const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
    const isDoc = ALLOWED_DOC_TYPES.includes(file.type);
    const isAudio = ALLOWED_AUDIO_TYPES.includes(file.type);
    
    if (!isImage && !isDoc && !isAudio) {
      return "Invalid file type. Please upload an image (jpg, jpeg, png, webp), document (pdf, docx, xlsx, pptx), or audio file (mp3, webm, wav, m4a, ogg)";
    }

    // If maxSizeMB is provided, use it, otherwise use default 5MB
    const sizeLimit = maxSizeMB ? maxSizeMB * 1024 * 1024 : MAX_FILE_SIZE;
    if (file.size > sizeLimit) {
      const displaySize = maxSizeMB || (MAX_FILE_SIZE / (1024 * 1024));
      return `File size exceeds ${displaySize}MB limit`;
    }
    return null;
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault(); // Prevent default behavior
    const selectedFile = e.target.files?.[0];
    actualSetFileError("");
    if (selectedFile) {
      console.log(`Selected file: ${selectedFile.name}, Size: ${(selectedFile.size / 1024 / 1024).toFixed(2)}MB, Type: ${selectedFile.type}`);
      const error = validateFile(selectedFile);
      if (error) {
        actualSetFileError(error);
        setFileSelected("");
        if (onChange) onChange(null);
        if (onFileChange) onFileChange(null);
        return;
      }
      setFileSelected(selectedFile.name);
      if (onChange) onChange(selectedFile);
      if (onFileChange) onFileChange(selectedFile);
      if (onFileSelect) onFileSelect(selectedFile); // Call onFileSelect if provided
    } else {
      setFileSelected("");
    }
  };

  // Display existing image if provided
  const hasImage = !!imageUrl;
  
  return <div className={`${hideLabel && hideDescription ? '' : 'space-y-2'}`}>
      {!hideLabel && <label htmlFor="file" className="block text-gray-700">
          <LanguageText>{uploadText || t("calendar.attachment")}</LanguageText>
        </label>}
      
      {hasImage && <div className="mb-3">
          <img src={imageUrl} alt="Preview" className="max-h-40 rounded-md object-cover" />
        </div>}
      
      <Input id="file" type="file" onChange={handleFileChange} accept={acceptedFileTypes || [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOC_TYPES, ...ALLOWED_AUDIO_TYPES].join(",")} className="cursor-pointer bg-background border-gray-300" onClick={e => {
      // Reset value before opening to ensure onChange triggers even if same file is selected
      (e.target as HTMLInputElement).value = '';
    }} disabled={disabled || isUploading} ref={ref} />
      
      {fileSelected && <p className="text-xs text-gray-500 mt-1">Selected: {fileSelected}</p>}
      
      {actualFileError && <p className="text-sm text-red-500 mt-1">{actualFileError}</p>}
      
      {!hideDescription && !actualFileError && (
        <p className="text-xs text-muted-foreground mt-1">
          {language === 'en' ? 
            "Supported: Images, Documents, Audio (Max 5MB)" :
            language === 'ka' ?
            "მხარდაჭერილია: სურათები, დოკუმენტები, აუდიო (მაქს. 5MB)" :
            <LanguageText>{t("common.supportedFormats")}</LanguageText>
          }
        </p>
      )}
    </div>;
});

FileUploadField.displayName = "FileUploadField";
