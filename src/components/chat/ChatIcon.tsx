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
          w-[244px] h-[56px]
          rounded-[12px] px-4 py-3
          text-white font-semibold text-[14px] leading-4 tracking-[0.2px]
          bg-gradient-to-r from-[#2563EB] via-[#6D28D9] to-[#DB2777]
          shadow-[0_8px_20px_rgba(109,40,217,0.35)]
          transition-all duration-150
          whitespace-nowrap pointer-events-auto
          ${isOpen ? 'scale-[0.99]' : 'hover:scale-[1.02] hover:shadow-[0_10px_24px_rgba(109,40,217,0.5)]'}
          ${isPending ? 'opacity-70 cursor-wait' : 'active:scale-[0.99]'}
          focus:outline-none focus:ring-4 focus:ring-[rgba(99,102,241,0.35)]
        `}
        style={{ zIndex: 60 }}
      >
        {/* Chat bubble wrapping smiling robot */}
        {isPending ? (
          <div className="animate-spin h-6 w-6 border-2 border-white border-t-transparent rounded-full" />
        ) : (
          <span className="relative inline-flex items-center justify-center w-6 h-6 flex-shrink-0">
            {/* Chat bubble outline */}
            <svg viewBox="0 0 24 24" className="absolute w-6 h-6" aria-hidden="true">
              <path 
                fill="none" 
                stroke="white" 
                strokeWidth="1.8" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                d="M7 18c-1.5 0-3-1.2-3-3V8c0-1.8 1.5-3 3.3-3h9.4C18.5 5 20 6.2 20 8v5c0 1.8-1.5 3-3.3 3H11l-3.1 2.2c-.5.4-1.2-.1-1-0.7L7 18z"
              />
            </svg>
            {/* Smiling robot face */}
            <svg viewBox="0 0 24 24" className="relative w-[18px] h-[18px]" aria-hidden="true">
              <path 
                fill="white" 
                d="M12 3a1 1 0 0 1 1 1v1c2.7.2 4.5 1.8 4.5 4.3v4.4c0 2.5-2.2 4-5.5 4s-5.5-1.5-5.5-4V9.3c0-2.5 1.8-4.1 4.5-4.3V4a1 1 0 0 1 1-1zM9.3 10.8a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm5.4 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM9.5 13.2c.5 1 1.5 1.6 2.5 1.6s2-.6 2.5-1.6H9.5z"
              />
            </svg>
          </span>
        )}
        
        {/* Text */}
        <span className="ml-1">
          {isPending ? loadingText : teamChatText}
        </span>
        
        {/* Yellow thunderbolt badge */}
        {!isPending && (
          <span
            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#FACC15]
                       flex items-center justify-center shadow-[0_2px_6px_rgba(0,0,0,0.25)]"
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-black">
              <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/>
            </svg>
          </span>
        )}
        
        {/* Unread count badge */}
        {unreadCount > 0 && !isPending && (
          <div className="absolute -top-2 -left-2 h-6 w-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold border-2 border-white shadow-lg z-10">
            {unreadCount > 9 ? '9+' : unreadCount}
          </div>
        )}
      </button>
    </div>
  );
};