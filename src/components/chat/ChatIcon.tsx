import { Bot, Pencil } from 'lucide-react';

interface ChatIconProps {
  onClick: () => void;
  isOpen: boolean;
  unreadCount?: number;
  isPending?: boolean;
  teamChatText: string;
  loadingText: string;
}

export const ChatIcon = ({ onClick, isOpen, unreadCount = 0, isPending = false, teamChatText, loadingText }: ChatIconProps) => {
  console.log('🎯 ChatIcon rendering:', { isOpen, unreadCount, isPending });
  
  return (
    <div className="fixed bottom-4 right-4 z-[9999] md:bottom-6 md:right-6" style={{ zIndex: 9999 }}>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('🖱️ ChatIcon clicked!');
          onClick();
        }}
        disabled={isPending}
        className={`
          relative h-12 px-4 rounded-lg shadow-2xl transition-all duration-300 pointer-events-auto
          flex items-center gap-2.5 text-white font-semibold text-sm
          bg-gradient-to-r from-[#4169E1] to-[#8B5CF6]
          hover:shadow-[0_8px_30px_rgba(139,92,246,0.4)]
          ${isOpen ? 'scale-95' : 'hover:scale-105'}
          ${isPending ? 'opacity-70 cursor-wait' : ''}
          md:h-11 md:px-5
        `}
        style={{ zIndex: 9999 }}
      >
        {/* Yellow edit icon badge */}
        <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-full flex items-center justify-center shadow-md">
          <Pencil className="h-2.5 w-2.5 text-blue-900" strokeWidth={2.5} />
        </div>

        {/* Bot icon */}
        {isPending ? (
          <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
        ) : (
          <Bot className="h-5 w-5 md:h-5 md:w-5" strokeWidth={2} />
        )}
        
        {/* Text */}
        <span className="text-sm md:text-sm whitespace-nowrap">
          {isPending ? loadingText : teamChatText}
        </span>
        
        {/* Unread count badge */}
        {unreadCount > 0 && !isPending && (
          <div className="absolute -top-2 -left-2 h-6 w-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold border-2 border-white shadow-lg">
            {unreadCount > 9 ? '9+' : unreadCount}
          </div>
        )}
      </button>
    </div>
  );
};