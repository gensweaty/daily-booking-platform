
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info, Upload } from "lucide-react";
import { FileDisplay } from "./FileDisplay";

// Helper function to format bytes
const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

interface FileUploadFieldProps {
  label?: string;
  placeholder?: string;
  onChange: (file: File | null) => void;
  value?: File | null;
  error?: string;
  helperText?: string;
  accept?: string;
  maxSizeMB?: number;
  tooltip?: string;
  hideLabel?: boolean;
  parentId?: string;
  parentType?: string;
  displayedFiles?: any[];
  onFileDeleted?: (fileId: string) => void;
  setFileError?: (error: string) => void;
  // For backward compatibility with existing code
  onFileChange?: (file: File | null) => void;
  fileError?: string;
}

export const FileUploadField = ({
  label = "Attachment",
  placeholder = "Upload file",
  onChange,
  onFileChange, // For backward compatibility
  value,
  error,
  fileError, // For backward compatibility
  helperText,
  accept = "image/*,application/pdf",
  maxSizeMB = 5,
  tooltip,
  hideLabel = false,
  parentId,
  parentType,
  displayedFiles,
  onFileDeleted,
  setFileError
}: FileUploadFieldProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const acceptedTypes = accept.split(',').map(ext => ext.trim().replace(/^\./, ''));
  const fieldId = `file-upload-${(label || "").toLowerCase().replace(/\s+/g, '-')}`;

  // Use either error or fileError, with error taking precedence
  const displayError = error || fileError;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) {
      if (onChange) onChange(null);
      if (onFileChange) onFileChange(null); // For backward compatibility
      return;
    }

    const maxSizeInBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeInBytes) {
      const errorMsg = `File size exceeds the maximum limit of ${maxSizeMB}MB.`;
      if (setFileError) setFileError(errorMsg);
      alert(errorMsg);
      e.target.value = '';
      return;
    }

    if (onChange) onChange(file);
    if (onFileChange) onFileChange(file); // For backward compatibility
  };

  const handleDelete = (fileId: string) => {
    if (onFileDeleted) onFileDeleted(fileId);
  };

  return (
    <div>
      <div className="flex items-center space-x-2">
        {!hideLabel && <Label htmlFor={fieldId}>{label}</Label>}
        {tooltip && <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Info className="h-4 w-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>
              {tooltip}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>}
      </div>
      
      <div className="mt-1.5">
        <Input
          id={fieldId}
          type="file"
          className="hidden"
          onChange={handleChange}
          accept={accept}
          ref={fileInputRef}
        />
        <div className="flex flex-col gap-2">
          <div>
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="w-full justify-start text-left font-normal"
            >
              <Upload className="mr-2 h-4 w-4" />
              {value ? value.name : placeholder}
            </Button>
          </div>
          
          {displayError && <p className="text-sm font-medium text-destructive">{displayError}</p>}
          
          {value && (
            <p className="text-xs text-muted-foreground">{formatBytes(value.size)}</p>
          )}
          
          {displayedFiles && displayedFiles.length > 0 && (
            <div className="mt-2">
              <h4 className="text-sm font-medium mb-1">Attached Files</h4>
              <FileDisplay 
                files={displayedFiles} 
                onFileDeleted={handleDelete}
                bucketName="customer_attachments"
                allowDelete
              />
            </div>
          )}
        </div>
        
        <div className="mt-1">
          {helperText && <p className="text-xs text-muted-foreground">{helperText}</p>}
          <p className="text-xs text-muted-foreground">
            {`Max size: ${maxSizeMB}MB, Supported formats: ${acceptedTypes.join(', ')}`}
          </p>
        </div>
      </div>
    </div>
  );
};
