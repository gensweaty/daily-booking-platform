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
          <Badge 
            variant="destructive" 
            className="absolute -top-1 -right-1 h-4 w-4 rounded-full p-0 text-xs font-medium flex items-center justify-center min-w-[16px]"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </Badge>
        )}
      </Button>
    </div>
  );
};