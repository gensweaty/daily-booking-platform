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
          <div className="animate-spin h-5 w-5 md:h-6 md:w-6 border-2 border-white border-t-transparent rounded-full" />
        ) : (
          <span className="relative inline-flex items-center justify-center w-7 h-7 md:w-8 md:h-8 flex-shrink-0">
            {/* Chat bubble with robot face matching reference image */}
            <svg viewBox="0 0 48 48" className="w-full h-full" aria-hidden="true">
              {/* Chat bubble outline - rounded square speech bubble */}
              <path 
                d="M8 12c0-3.3 2.7-6 6-6h20c3.3 0 6 2.7 6 6v16c0 3.3-2.7 6-6 6h-8l-6 5c-.8.6-2-.1-1.8-1.2l.6-3.8H14c-3.3 0-6-2.7-6-6V12z" 
                fill="none" 
                stroke="white" 
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              
              {/* Robot head - white filled circle */}
              <circle cx="24" cy="20" r="9.5" fill="white" />
              
              {/* Left headphone arc */}
              <path 
                d="M16 19c0-4.4 3.6-8 8-8" 
                fill="none" 
                stroke="white" 
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              
              {/* Right headphone arc */}
              <path 
                d="M32 19c0-4.4-3.6-8-8-8" 
                fill="none" 
                stroke="white" 
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              
              {/* Left eye - solid blue dot */}
              <circle cx="21" cy="19" r="1.8" fill="#2563EB" />
              
              {/* Right eye - solid blue dot */}
              <circle cx="27" cy="19" r="1.8" fill="#2563EB" />
              
              {/* Happy smile - curved line */}
              <path 
                d="M20 23.5c1 1.5 2.5 2.5 4 2.5s3-1 4-2.5" 
                fill="none" 
                stroke="#2563EB" 
                strokeWidth="2"
                strokeLinecap="round"
              />
              
              {/* Top antenna */}
              <line x1="24" y1="10.5" x2="24" y2="8" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
              <circle cx="24" cy="7" r="1.4" fill="white" />
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