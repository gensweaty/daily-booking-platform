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
    <div className="fixed bottom-5 right-5 z-[60]" style={{ zIndex: 60 }}>
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
          px-3.5 py-2.5 h-11
          rounded-xl
          text-white font-semibold text-sm
          bg-gradient-to-r from-[#2563EB] via-[#6D28D9] to-[#DB2777]
          shadow-[0_6px_16px_rgba(109,40,217,0.35)]
          transition-all duration-150
          whitespace-nowrap pointer-events-auto
          ${isOpen ? 'scale-[0.98]' : 'hover:scale-[1.02] hover:shadow-[0_8px_20px_rgba(109,40,217,0.5)]'}
          ${isPending ? 'opacity-70 cursor-wait' : 'active:scale-[0.98]'}
          focus:outline-none focus:ring-3 focus:ring-[rgba(99,102,241,0.35)]
        `}
        style={{ zIndex: 60 }}
      >
        {/* Chat bubble with robot icon */}
        {isPending ? (
          <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
        ) : (
          <span className="relative inline-flex items-center justify-center w-7 h-7 flex-shrink-0">
            {/* Chat bubble with robot face - simplified matching reference */}
            <svg viewBox="0 0 40 40" className="w-7 h-7" aria-hidden="true">
              {/* Outer chat bubble */}
              <path 
                d="M8 10c0-2.2 1.8-4 4-4h16c2.2 0 4 1.8 4 4v12c0 2.2-1.8 4-4 4h-8l-5 4c-.6.5-1.5-.1-1.3-.9l.8-3.1H12c-2.2 0-4-1.8-4-4V10z" 
                fill="none" 
                stroke="white" 
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Robot head circle */}
              <circle cx="20" cy="16" r="7" fill="white" />
              {/* Left eye */}
              <circle cx="17.5" cy="15" r="1.5" fill="#2563EB" />
              {/* Right eye */}
              <circle cx="22.5" cy="15" r="1.5" fill="#2563EB" />
              {/* Smile arc */}
              <path 
                d="M17 19c.8 1 2 1.5 3 1.5s2.2-.5 3-1.5" 
                fill="none" 
                stroke="#2563EB" 
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              {/* Antenna */}
              <line x1="20" y1="9" x2="20" y2="7" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="20" cy="6" r="1" fill="white" />
            </svg>
          </span>
        )}
        
        {/* Text */}
        <span>
          {isPending ? loadingText : teamChatText}
        </span>
        
        {/* Yellow thunderbolt badge */}
        {!isPending && (
          <span
            className="absolute -top-2 -right-2 w-[26px] h-[26px] rounded-full bg-[#FACC15]
                       flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
            aria-hidden="true"
          >
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 fill-black">
              <path d="M8.5 1 3 9h4l-.5 6 5.5-8h-4l.5-6z"/>
            </svg>
          </span>
        )}
        
        {/* Unread count badge */}
        {unreadCount > 0 && !isPending && (
          <div className="absolute -top-2 -left-2 h-5 w-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-white shadow-lg z-10">
            {unreadCount > 9 ? '9+' : unreadCount}
          </div>
        )}
      </button>
    </div>
  );
};