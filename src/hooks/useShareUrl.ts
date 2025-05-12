
import { useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';

export const useShareUrl = () => {
  const [isSharing, setIsSharing] = useState(false);
  const { toast } = useToast();
  const { t } = useLanguage();
  
  const shareUrl = async (url: string, title: string) => {
    setIsSharing(true);
    
    try {
      if (navigator.share) {
        await navigator.share({
          title,
          url,
        });
      } else {
        // Fallback to clipboard
        await navigator.clipboard.writeText(url);
        toast({
          description: t('business.copiedToClipboard'),
          duration: 2000,
        });
      }
    } catch (error) {
      console.error('Error sharing:', error);
    } finally {
      setIsSharing(false);
    }
  };
  
  return { shareUrl, isSharing };
};
