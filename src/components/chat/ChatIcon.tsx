import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageText } from '@/components/shared/LanguageText';

interface ChatIconProps {
  onClick: () => void;
  isOpen: boolean;
  unreadCount?: number;
  isPending?: boolean;
}

export const ChatIcon = ({ onClick, isOpen, unreadCount = 0, isPending = false }: ChatIconProps) => {
  const { t } = useLanguage();
  console.log('🎯 ChatIcon rendering:', { isOpen, unreadCount, isPending });
  
  return (
    <div className="fixed bottom-2 right-2 z-[9999]" style={{ zIndex: 9999 }}>
      <Button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('🖱️ ChatIcon clicked!');
          onClick();
        }}
        size="sm"
        disabled={isPending}
        className={`
          relative h-8 px-3 bg-muted/90 hover:bg-muted border shadow-lg transition-all duration-200 pointer-events-auto
          flex items-center gap-2 text-sm font-medium
          ${isOpen 
            ? 'bg-muted hover:bg-muted/80 scale-95' 
            : 'hover:scale-105'
          }
          ${isPending 
            ? 'opacity-70 cursor-wait' 
            : ''
          }
        `}
        style={{ zIndex: 9999 }}
      >
        {isPending ? (
          <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
        ) : (
          <MessageCircle className="h-4 w-4" />
        )}
        <span>
          <LanguageText>{isPending ? t('chat.loading') : t('chat.teamChat')}</LanguageText>
        </span>
        
        {unreadCount > 0 && !isPending && (
          <div className="absolute -top-2 -right-2 h-5 w-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold border-2 border-background">
            {unreadCount > 9 ? '9+' : unreadCount}
          </div>
        )}
      </Button>
    </div>
  );
};