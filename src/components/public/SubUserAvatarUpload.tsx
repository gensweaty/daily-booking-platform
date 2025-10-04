import { useState, useRef } from 'react';
import { User, Upload, Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/components/ui/use-toast';

interface SubUserAvatarUploadProps {
  avatarUrl?: string | null;
  onAvatarUpload?: (file: File) => Promise<void>;
  size?: 'sm' | 'md' | 'lg';
}

export const SubUserAvatarUpload = ({ avatarUrl, onAvatarUpload, size = 'md' }: SubUserAvatarUploadProps) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-20 h-20',
    lg: 'w-32 h-32'
  };

  const iconSizes = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-16 h-16'
  };

  const uploadSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-6 h-6'
  };

  const validateFile = (file: File): string | null => {
    const allowedTypes = ['image/png', 'image/jpg', 'image/jpeg', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!allowedTypes.includes(file.type)) {
      return 'Invalid file type. Please upload PNG, JPG, JPEG, or WEBP.';
    }

    if (file.size > maxSize) {
      return 'File size too large. Maximum 5MB allowed.';
    }

    return null;
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !onAvatarUpload) return;

    const validationError = validateFile(file);
    if (validationError) {
      toast({
        title: 'Error',
        description: validationError,
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      await onAvatarUpload(file);
    } catch (error) {
      console.error('Error uploading avatar:', error);
    } finally {
      setIsUploading(false);
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleClick = () => {
    if (!isUploading) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div className="relative flex justify-center">
      <div
        className={`${sizeClasses[size]} relative bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/50 dark:to-purple-900/50 rounded-full flex items-center justify-center overflow-hidden border-2 border-white dark:border-gray-700 shadow-lg cursor-pointer transition-all duration-300 ${
          isHovered ? 'scale-105 shadow-xl' : ''
        }`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleClick}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt="Avatar"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full">
            <User className={`${iconSizes[size]} text-gray-400 dark:text-gray-500`} />
          </div>
        )}

        {/* Overlay with upload icon */}
        {(isHovered || isUploading) && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity duration-300">
            {isUploading ? (
              <Loader2 className={`${uploadSizes[size]} text-white animate-spin`} />
            ) : (
              <Upload className={`${uploadSizes[size]} text-white`} />
            )}
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpg,image/jpeg,image/webp"
        onChange={handleFileSelect}
        className="hidden"
        disabled={isUploading}
      />

      {/* Tooltip */}
      {isHovered && !isUploading && (
        <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
          {avatarUrl ? 'Change Avatar' : 'Upload Avatar'}
        </div>
      )}
    </div>
  );
};