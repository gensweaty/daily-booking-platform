
import { useState, useRef } from 'react';
import { Upload, Camera } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import { LanguageText } from '@/components/shared/LanguageText';
import { GeorgianAuthText } from '@/components/shared/GeorgianAuthText';

interface AvatarUploadProps {
  avatarUrl?: string;
  onAvatarUpdate: (url: string) => void;
}

export const AvatarUpload = ({ avatarUrl, onAvatarUpdate }: AvatarUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpg', 'image/jpeg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: t('common.error'),
        description: 'Please upload a PNG, JPG, JPEG, or WebP image',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: t('common.error'),
        description: 'File size must be less than 5MB',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);

    try {
      // Create unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Update user profile with avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) {
        throw updateError;
      }

      onAvatarUpdate(publicUrl);
      
      toast({
        title: t('profile.avatarUploadSuccess'),
        description: isGeorgian ? 
          <GeorgianAuthText>ავატარი წარმატებით აიტვირთა</GeorgianAuthText> :
          t('profile.avatarUploadSuccess'),
      });
    } catch (error) {
      console.error('Avatar upload error:', error);
      toast({
        title: t('profile.avatarUploadError'),
        description: isGeorgian ? 
          <GeorgianAuthText>ავატარის ატვირთვა ვერ მოხერხდა</GeorgianAuthText> :
          t('profile.avatarUploadError'),
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="relative flex flex-col items-center">
      <div
        className="relative w-20 h-20 rounded-full cursor-pointer group"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleClick}
      >
        {/* Avatar or default user icon */}
        <div className="w-full h-full bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm overflow-hidden">
          {avatarUrl ? (
            <img 
              src={avatarUrl} 
              alt="Avatar" 
              className="w-full h-full object-cover rounded-full"
            />
          ) : (
            <Camera className="w-10 h-10 text-white" />
          )}
        </div>

        {/* Hover overlay */}
        {(isHovered || isUploading) && (
          <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center transition-opacity">
            {isUploading ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Upload className="w-6 h-6 text-white" />
            )}
          </div>
        )}
      </div>

      {/* Upload text */}
      <p className="text-xs text-white/70 mt-2 text-center">
        {isGeorgian ? (
          <GeorgianAuthText>{t('profile.changeAvatar')}</GeorgianAuthText>
        ) : (
          <LanguageText>{t('profile.changeAvatar')}</LanguageText>
        )}
      </p>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpg,image/jpeg,image/webp"
        onChange={handleFileSelect}
        className="hidden"
        disabled={isUploading}
      />
    </div>
  );
};
