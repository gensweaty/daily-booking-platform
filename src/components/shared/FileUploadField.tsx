
import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LanguageText } from './LanguageText';

export interface FileUploadFieldProps {
  // Required props
  onChange: (file: File | null) => void;
  fileError: string;
  setFileError: (error: string) => void;
  selectedFile: File | null;
  
  // Optional props
  acceptedFileTypes?: string;
  maxSizeInMB?: number;
  hideLabel?: boolean;
  
  // Backward compatibility props for BusinessProfileForm
  imageUrl?: string;
  onUpload?: (...event: any[]) => void;
  bucket?: string;
  uploadText?: string;
  chooseFileText?: string;
  noFileText?: string;
}

export const FileUploadField: React.FC<FileUploadFieldProps> = ({
  onChange,
  fileError,
  setFileError,
  acceptedFileTypes = ".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx,.txt", // Default value
  selectedFile,
  maxSizeInMB = 10, // Default to 10MB
  hideLabel = false,
  // Backward compatibility props for BusinessProfileForm
  imageUrl,
  onUpload,
  bucket,
  uploadText,
  chooseFileText,
  noFileText
}) => {
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      onChange(null);
      return;
    }

    // Validate file type
    const fileExtension = `.${file.name.split('.').pop()?.toLowerCase()}`;
    const acceptedTypes = acceptedFileTypes.split(',');
    if (!acceptedTypes.some(type => type.trim() === fileExtension || type.trim() === file.type)) {
      setFileError(t('common.invalidFileType'));
      onChange(null);
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    // Validate file size
    const maxSizeInBytes = maxSizeInMB * 1024 * 1024; // Convert MB to bytes
    if (file.size > maxSizeInBytes) {
      setFileError(t('common.fileTooLarge', { maxSize: maxSizeInMB }));
      onChange(null);
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setFileError('');
    onChange(file);
    // If onUpload is provided (for BusinessProfileForm), call it as well
    if (onUpload) {
      onUpload(file);
    }
  };

  const handleRemoveFile = () => {
    onChange(null);
    setFileError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      {!hideLabel && (
        <label htmlFor="file" className={cn("block text-sm font-medium", isGeorgian ? "font-georgian" : "")}>
          <LanguageText>{t('common.attachFile')}</LanguageText>
        </label>
      )}
      
      <div className="flex flex-col gap-2">
        {selectedFile ? (
          <div className="flex items-center justify-between p-2 border rounded">
            <span className="truncate max-w-[200px]">{selectedFile.name}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemoveFile}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Remove file</span>
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <input
              ref={fileInputRef}
              id="file"
              type="file"
              onChange={handleFileChange}
              accept={acceptedFileTypes}
              className="hidden"
            />
            <label
              htmlFor="file"
              className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring border border-input bg-background hover:bg-accent hover:text-accent-foreground px-4 py-2 w-full"
            >
              <span className={isGeorgian ? "font-georgian" : ""}>
                <LanguageText>{uploadText || t('common.chooseFile')}</LanguageText>
              </span>
            </label>
            {fileError && <p className="text-sm text-destructive">{fileError}</p>}
          </div>
        )}
      </div>
    </div>
  );
};
