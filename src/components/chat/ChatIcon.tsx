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
    <div className="fixed bottom-6 right-6 z-[9999]" style={{ zIndex: 9999 }}>
      <Button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('🖱️ ChatIcon clicked!');
          onClick();
        }}
        size="lg"
        className={`
          relative h-14 w-14 rounded-full shadow-lg transition-all duration-200 pointer-events-auto
          ${isOpen 
            ? 'bg-primary/90 hover:bg-primary scale-95' 
            : 'bg-primary hover:bg-primary/90 hover:scale-105'
          }
        `}
        style={{ zIndex: 9999 }}
      >
        <MessageCircle className="h-6 w-6 text-primary-foreground" />
        
        {unreadCount > 0 && (
          <Badge 
            variant="destructive" 
            className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs font-medium flex items-center justify-center"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </Button>
    </div>
  );
};