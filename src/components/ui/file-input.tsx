
import React from 'react';
import { Input } from '@/components/ui/input';

interface FileInputProps {
  onChange: (file: File | null) => void;
  accept?: string;
  placeholder?: string;
}

export const FileInput: React.FC<FileInputProps> = ({ 
  onChange, 
  accept = "*/*", 
  placeholder = "Choose file..." 
}) => {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    onChange(file);
  };

  return (
    <Input
      type="file"
      accept={accept}
      onChange={handleFileChange}
      placeholder={placeholder}
    />
  );
};
