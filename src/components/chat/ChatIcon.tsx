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
          px-3 py-2 h-10
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
          <div className="animate-spin h-6 w-6 border-2 border-white border-t-transparent rounded-full" />
        ) : (
          <span className="relative inline-flex items-center justify-center w-8 h-8 flex-shrink-0">
            {/* Simplified chat bubble + robot matching reference */}
            <svg viewBox="0 0 32 32" className="w-8 h-8" aria-hidden="true">
              {/* Chat bubble outline */}
              <path 
                d="M6 8c0-2 1.5-3.5 3.5-3.5h13c2 0 3.5 1.5 3.5 3.5v9c0 2-1.5 3.5-3.5 3.5h-6l-4 3.2c-.6.5-1.4 0-1.3-.7l.3-2.5h-.5c-2 0-3.5-1.5-3.5-3.5V8z" 
                fill="none" 
                stroke="white" 
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Robot head - white circle */}
              <circle cx="16" cy="13" r="6" fill="white" />
              {/* Left eye */}
              <circle cx="14" cy="12.5" r="1.3" fill="#2563EB" />
              {/* Right eye */}
              <circle cx="18" cy="12.5" r="1.3" fill="#2563EB" />
              {/* Wide smile */}
              <path 
                d="M13 15.5c.6.8 1.8 1.3 3 1.3s2.4-.5 3-1.3" 
                fill="none" 
                stroke="#2563EB" 
                strokeWidth="1.4"
                strokeLinecap="round"
              />
              {/* Antenna */}
              <line x1="16" y1="7" x2="16" y2="5.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
              <circle cx="16" cy="4.8" r="0.9" fill="white" />
              {/* Headphone arcs */}
              <path d="M11 11.5c0-2.8 2.2-5 5-5" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
              <path d="M21 11.5c0-2.8-2.2-5-5-5" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
            </svg>
          </span>
        )}
        
        {/* Text */}
        <span className="text-[13px]">
          {isPending ? loadingText : teamChatText}
        </span>
        
        {/* Yellow thunderbolt badge */}
        {!isPending && (
          <span
            className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-[#FACC15]
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
          <div className="absolute -top-2 -left-2 h-5 w-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-white shadow-lg z-10">
            {unreadCount > 9 ? '9+' : unreadCount}
          </div>
        )}
      </button>
    </div>
  );
};