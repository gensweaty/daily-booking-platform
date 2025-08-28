import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ChatIconProps {
  onClick: () => void;
  isOpen: boolean;
  unreadCount?: number;
}

export const ChatIcon = ({ onClick, isOpen, unreadCount = 0 }: ChatIconProps) => {
  console.log('🎯 ChatIcon rendering:', { isOpen, unreadCount });
  
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
        className={`
          relative h-8 px-3 bg-muted/90 hover:bg-muted border shadow-lg transition-all duration-200 pointer-events-auto
          flex items-center gap-2 text-sm font-medium
          ${isOpen 
            ? 'bg-muted hover:bg-muted/80 scale-95' 
            : 'hover:scale-105'
          }
        `}
        style={{ zIndex: 9999 }}
      >
        <MessageCircle className="h-4 w-4" />
        <span>Team Chat</span>
        
        {unreadCount > 0 && (
          <div className="absolute -top-2 -right-2 h-5 w-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold border-2 border-background">
            {unreadCount > 9 ? '9+' : unreadCount}
          </div>
        )}
      </Button>
    </div>
  );
};