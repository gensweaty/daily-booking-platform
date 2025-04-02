import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Info, Upload } from "lucide-react";
import { formatBytes } from "@/lib/utils";
import { FileDisplay } from "./FileDisplay";

interface FileUploadFieldProps {
  label: string;
  placeholder: string;
  onChange: (file: File | null) => void;
  value: File | null;
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
}

export const FileUploadField = ({
  label,
  placeholder,
  onChange,
  value,
  error,
  helperText,
  accept = "image/*,application/pdf",
  maxSizeMB = 5,
  tooltip,
  hideLabel = false,
  parentId,
  parentType,
  displayedFiles,
  onFileDeleted
}: FileUploadFieldProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const acceptedExtensions = accept.split(',').map(ext => ext.trim().replace(/^\./, '')).join(', ');
  const fieldId = `file-upload-${label.toLowerCase().replace(/\s+/g, '-')}`;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) {
      onChange(null);
      return;
    }

    const maxSizeInBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeInBytes) {
      alert(`File size exceeds the maximum limit of ${maxSizeMB}MB.`);
      e.target.value = '';
      return;
    }

    onChange(file);
  };

  const handleDelete = (fileId: string) => {
    onFileDeleted?.(fileId);
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
          
          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
          
          {value && (
            <p className="text-xs text-muted-foreground">{formatBytes(value.size)}</p>
          )}
          
          {displayedFiles && displayedFiles.length > 0 && (
            <div className="mt-2">
              <h4 className="text-sm font-medium mb-1">Attached Files</h4>
              <FileDisplay 
                files={displayedFiles} 
                onDelete={handleDelete}
                parentId={parentId}
                parentType={parentType} 
              />
            </div>
          )}
        </div>
        
        <div className="mt-1">
          {helperText && <p className="text-xs text-muted-foreground">{helperText}</p>}
          <p className="text-xs text-muted-foreground">
            {`Max size: ${maxSizeMB}MB, Supported formats: ${acceptedExtensions.join(', ')}`}
          </p>
        </div>
      </div>
    </div>
  );
};
