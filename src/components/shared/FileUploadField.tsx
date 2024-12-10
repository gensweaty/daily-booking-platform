import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MAX_FILE_SIZE_DOCS = 1024 * 1024; // 1MB
const MAX_FILE_SIZE_IMAGES = 2048 * 1024; // 2MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const ALLOWED_DOC_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
];

interface FileUploadFieldProps {
  onFileChange: (file: File | null) => void;
  fileError: string;
  setFileError: (error: string) => void;
}

export const FileUploadField = ({ onFileChange, fileError, setFileError }: FileUploadFieldProps) => {
  const validateFile = (file: File) => {
    const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
    const isDoc = ALLOWED_DOC_TYPES.includes(file.type);
    
    if (!isImage && !isDoc) {
      return "Invalid file type. Please upload an image (jpg, jpeg, png, webp) or document (pdf, docx, xlsx, pptx)";
    }

    const maxSize = isImage ? MAX_FILE_SIZE_IMAGES : MAX_FILE_SIZE_DOCS;
    if (file.size > maxSize) {
      return `File size exceeds ${maxSize / (1024 * 1024)}MB limit`;
    }

    return null;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    setFileError("");

    if (selectedFile) {
      const error = validateFile(selectedFile);
      if (error) {
        setFileError(error);
        onFileChange(null);
        return;
      }
      onFileChange(selectedFile);
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="file" className="text-foreground">Attachment (optional)</Label>
      <Input
        id="file"
        type="file"
        onChange={handleFileChange}
        accept={[...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOC_TYPES].join(",")}
        className="cursor-pointer bg-background border-gray-700"
      />
      {fileError && (
        <p className="text-sm text-red-500 mt-1">{fileError}</p>
      )}
      <p className="text-[0.33rem] text-muted-foreground mt-1">
        Max size: Images - 2MB, Documents - 1MB
        <br />
        Supported formats: Images (jpg, jpeg, png, webp), Documents (pdf, docx, xlsx, pptx)
      </p>
    </div>
  );
};