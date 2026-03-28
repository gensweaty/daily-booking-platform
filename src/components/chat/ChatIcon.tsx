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
    <div className="fixed bottom-2 right-4 z-[60]" style={{ zIndex: 60 }}>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('🖱️ ChatIcon clicked!');
          onClick();
        }}
        disabled={isPending}
        aria-label="Open AI & Team Chat"
        className={`
          relative inline-flex items-center gap-2
          px-3 py-2 h-10 md:h-11
          rounded-xl md:rounded-[14px]
          text-white font-semibold text-xs md:text-sm
          bg-gradient-to-r from-[#335CF4] to-[#2548C9]
          shadow-[0_6px_16px_rgba(51,92,244,0.35)]
          transition-all duration-150
          whitespace-nowrap pointer-events-auto
          ${isOpen ? 'scale-[0.98]' : 'hover:scale-[1.02] hover:shadow-[0_8px_20px_rgba(51,92,244,0.5)]'}
          ${isPending ? 'opacity-70 cursor-wait' : 'active:scale-[0.98]'}
          focus:outline-none focus:ring-3 focus:ring-[rgba(51,92,244,0.35)]
        `}
        style={{ zIndex: 60 }}
      >
        {/* Robot icon - Smartbookly brand character */}
        {isPending ? (
          <div className="animate-spin h-5 w-5 md:h-6 md:w-6 border-2 border-white border-t-transparent rounded-full" />
        ) : (
          <span className="relative inline-flex items-center justify-center w-7 h-7 md:w-8 md:h-8 flex-shrink-0">
            <svg viewBox="0 0 48 48" className="w-full h-full" aria-hidden="true">
              {/* Robot body - rounded square */}
              <rect x="8" y="12" width="32" height="28" rx="8" ry="8" fill="white" />
              
              {/* Antenna bumps */}
              <circle cx="18" cy="10" r="3" fill="white" />
              <circle cx="30" cy="10" r="3" fill="white" />
              
              {/* Single eye - large circle */}
              <circle cx="24" cy="26" r="10" fill="#335CF4" />
              <circle cx="24" cy="26" r="7" fill="white" />
              <circle cx="22" cy="24" r="3.5" fill="#335CF4" />
              <circle cx="21" cy="23" r="1.2" fill="white" />
              
              {/* Little legs */}
              <rect x="14" y="40" width="4" height="5" rx="2" fill="white" />
              <rect x="30" y="40" width="4" height="5" rx="2" fill="white" />
            </svg>
          </span>
        )}
        
        {/* Text */}
        <span className="text-[13px]">
          {isPending ? loadingText : teamChatText}
        </span>
        
        {/* Yellow thunderbolt badge - brand yellow */}
        {!isPending && (
          <span
            className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-[#08B531]
                       flex items-center justify-center shadow-[0_3px_10px_rgba(0,0,0,0.35)]"
            aria-hidden="true"
          >
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 fill-black">
              <path d="M8.5 1.5 3.5 9h4l-.5 5.5 5-7.5h-4l.5-5.5z"/>
            </svg>
          </span>
        )}
        
        {/* Unread count badge */}
        {unreadCount > 0 && !isPending && (
          <div className="absolute -top-2 -left-2 h-5 w-5 bg-[#FF4E32] text-white rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-white shadow-lg z-10">
            {unreadCount > 9 ? '9+' : unreadCount}
          </div>
        )}
      </button>
    </div>
  );
};
