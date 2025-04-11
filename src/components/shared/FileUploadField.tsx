
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";

const MAX_FILE_SIZE_DOCS = 1024 * 1024; // 1MB
const MAX_FILE_SIZE_IMAGES = 50 * 1024 * 1024; // 50MB for images
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const ALLOWED_DOC_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
];

interface FileUploadFieldProps {
  onChange: (file: File | null) => void;
  onFileChange?: (file: File | null) => void; // For backward compatibility
  fileError: string;
  setFileError: (error: string) => void;
  acceptedFileTypes?: string;
  hideLabel?: boolean;
  hideDescription?: boolean; // Added to hide the description text
}

export const FileUploadField = ({ 
  onChange, 
  onFileChange, 
  fileError, 
  setFileError, 
  acceptedFileTypes, 
  hideLabel = false,
  hideDescription = false
}: FileUploadFieldProps) => {
  const { t } = useLanguage();

  const validateFile = (file: File) => {
    const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
    const isDoc = ALLOWED_DOC_TYPES.includes(file.type);
    
    if (!isImage && !isDoc) {
      return "Invalid file type. Please upload an image (jpg, jpeg, png, webp) or document (pdf, docx, xlsx, pptx)";
    }

    const maxSize = isImage ? MAX_FILE_SIZE_IMAGES : MAX_FILE_SIZE_DOCS;
    if (file.size > maxSize) {
      const sizeMB = maxSize / (1024 * 1024);
      return `File size exceeds ${sizeMB}MB limit${isImage ? ' for images' : ' for documents'}`;
    }

    return null;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault(); // Prevent default behavior
    const selectedFile = e.target.files?.[0];
    setFileError("");

    if (selectedFile) {
      console.log(`Selected file: ${selectedFile.name}, Size: ${(selectedFile.size / 1024 / 1024).toFixed(2)}MB, Type: ${selectedFile.type}`);
      const error = validateFile(selectedFile);
      if (error) {
        setFileError(error);
        if (onChange) onChange(null);
        if (onFileChange) onFileChange(null);
        return;
      }
      if (onChange) onChange(selectedFile);
      if (onFileChange) onFileChange(selectedFile);
    }
  };

  return (
    <div className={`${hideLabel && hideDescription ? '' : 'space-y-2'}`}>
      {!hideLabel && (
        <label htmlFor="file" className="block text-gray-700">{t("calendar.attachment")}</label>
      )}
      <Input
        id="file"
        type="file"
        onChange={handleFileChange}
        accept={acceptedFileTypes || [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOC_TYPES].join(",")}
        className="cursor-pointer bg-background border-gray-300"
        onClick={(e) => {
          // Reset value before opening to ensure onChange triggers even if same file is selected
          (e.target as HTMLInputElement).value = '';
        }}
      />
      {fileError && (
        <p className="text-sm text-red-500 mt-1">{fileError}</p>
      )}
      {!hideDescription && !fileError && (
        <p className="text-xs text-muted-foreground mt-1">
          Supported formats: images (jpg, png, webp) up to 50MB, documents (pdf, docx, xlsx, pptx) up to 1MB
        </p>
      )}
    </div>
  );
};
