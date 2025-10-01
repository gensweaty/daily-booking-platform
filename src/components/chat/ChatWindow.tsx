import { useState, useRef, useEffect } from 'react';
import { X, Minus, Maximize2, Minimize2, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ChatSidebar } from './ChatSidebar';
import { ChatArea } from './ChatArea';
import { useChat } from './ChatProvider';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageText } from '@/components/shared/LanguageText';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import './mobile-chat.css';

interface ChatWindowProps {
  isOpen: boolean;
  onClose: () => void;
}

type WindowState = 'normal' | 'minimized' | 'maximized';

export const ChatWindow = ({ isOpen, onClose }: ChatWindowProps) => {
  const { t } = useLanguage();
  const [windowState, setWindowState] = useState<WindowState>('normal');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  const cardRef = useRef<HTMLDivElement>(null);
  const { isInitialized } = useChat();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  
  // Detect public board (external link)
  const isOnPublicBoard =
    typeof window !== 'undefined' && window.location.pathname.startsWith('/board/');

  // Force show the top bar on mobile public boards (matches internal/mobile UI)
  const forceShowMobileTitleBar = isMobile && isOnPublicBoard;

  // Set state on mount - minimized on first open for desktop, maximized for mobile
  useEffect(() => {
    if (!isOpen) return;
    if (isMobile) {
      setWindowState('maximized');
      setIsSidebarCollapsed(true);
    } else {
      setWindowState('minimized');
    }
  }, [isOpen, isMobile]);

  // Mobile keyboard detection and height tracking
  useEffect(() => {
    if (!isMobile || typeof window === 'undefined') return;

    const handleKeyboardShow = () => {
      // Use visual viewport if available (modern browsers)
      if ('visualViewport' in window && (window as any).visualViewport) {
        const viewport = (window as any).visualViewport;
        const updateHeight = () => {
          if (viewport && viewport.height) {
            const keyboardHeight = window.innerHeight - viewport.height;
            setKeyboardHeight(Math.max(0, keyboardHeight));
          }
        };
        
        viewport.addEventListener('resize', updateHeight);
        updateHeight();
        
        return () => viewport.removeEventListener('resize', updateHeight);
      } else {
        // Fallback for older browsers
        const initialHeight = window.innerHeight;
        const handleResize = () => {
          const currentHeight = window.innerHeight;
          const keyboardHeight = Math.max(0, initialHeight - currentHeight);
          setKeyboardHeight(keyboardHeight);
        };
        
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
      }
    };

    return handleKeyboardShow();
  }, [isMobile]);

  // Auto-close sidebar on mobile when typing
  const handleMobileSidebarAutoClose = () => {
    if (isMobile && !isSidebarCollapsed) {
      setIsSidebarCollapsed(true);
    }
  };

  // Listen for custom event to toggle sidebar (from mobile header)
  useEffect(() => {
    const handler = () => setIsSidebarCollapsed(s => !s);
    window.addEventListener("chat-toggle-sidebar", handler);
    return () => window.removeEventListener("chat-toggle-sidebar", handler);
  }, []);


  const toggleMinimize = () => {
    if (isMobile) return; // No minimize on mobile
    setWindowState(prev => prev === 'minimized' ? 'normal' : 'minimized');
  };

  const toggleMaximize = () => {
    if (isMobile) return; // Mobile always stays maximized
    setWindowState(prev => prev === 'maximized' ? 'normal' : 'maximized');
  };

  const getWindowStyle = (): React.CSSProperties => {
    if (isMobile) {
      return {
        inset: 0,
        width: '100vw',
        height: '100dvh', // Use dynamic viewport height for mobile
        paddingBottom: keyboardHeight > 0 ? `${keyboardHeight}px` : '0'
      };
    }
    
    // Fixed bottom-right positioning for desktop
    const baseStyle = {
      bottom: '8px',
      right: '8px'
    };
    
    switch (windowState) {
      case 'minimized':
        return {
          ...baseStyle,
          width: 'min(350px, calc(100vw - 16px))',
          height: '56px'
        };
      case 'maximized':
        return {
          inset: 0,
          width: '100vw',
          height: '100vh'
        };
      default: // normal
        return {
          ...baseStyle,
          width: 'min(600px, calc(100vw - 16px))',
          height: 'min(700px, calc(100vh - 16px))'
        };
    }
  };

  if (!isOpen) return null;

  return (
    <Card
      ref={cardRef}
      className={cn(
        // below header (12002) but above page
        "fixed bg-background border shadow-lg pointer-events-auto z-[12001]",
        "grid grid-rows-[auto,1fr] overflow-hidden",
        windowState === 'maximized' ? 'rounded-none' : 'rounded-lg',
        isMobile ? 'chat-mobile-transition chat-mobile-viewport chat-container-mobile' : 'transition-all duration-300'
      )}
      style={getWindowStyle()}
    >
      {/* Title Bar */}
      <div
        id="chat-titlebar"
        className={cn(
          "flex items-center justify-between px-3 py-2 border-b bg-muted/50",
          "min-h-[52px] shrink-0", // Consistent height with better spacing
          windowState === 'minimized' ? "h-[52px]" : "" // Fixed height when minimized
        )}
        // beat any mobile CSS that hides this on public boards
        style={forceShowMobileTitleBar ? { display: 'flex' } : undefined}
      >
        <div className="flex items-center gap-2 min-w-0">
          {windowState !== 'minimized' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className={cn(
                "h-6 w-6 p-0 shrink-0",
                isMobile && "chat-mobile-button"
              )}
              title="Toggle Sidebar"
            >
              <Menu className="h-3 w-3" />
            </Button>
          )}
          <span className="font-medium text-sm truncate">
            <LanguageText>{t('chat.teamChat')}</LanguageText>
          </span>
        </div>
        
        <div className="flex items-center gap-1 shrink-0">
          {!isMobile && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleMinimize}
                className="h-6 w-6 p-0 hover:bg-muted"
                title={windowState === 'minimized' ? 'Restore' : 'Minimize'}
              >
                <Minus className="h-3 w-3" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleMaximize}
                className="h-6 w-6 p-0 hover:bg-muted"
                title={windowState === 'maximized' ? 'Restore Down' : 'Maximize'}
              >
                {windowState === 'maximized' ? (
                  <Minimize2 className="h-3 w-3" />
                ) : (
                  <Maximize2 className="h-3 w-3" />
                )}
              </Button>
            </>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
            title="Close"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* hard override in case a CSS rule used !important to hide the title bar */}
      {forceShowMobileTitleBar && (
        <style>{`#chat-titlebar{display:flex !important}`}</style>
      )}

      {/* Chat Content */}
      {windowState !== 'minimized' && (
        <div className="grid grid-cols-[auto,1fr] overflow-hidden min-h-0">
          {/* Sidebar */}
          <div className={cn(
            "border-r overflow-hidden bg-muted/20",
            isSidebarCollapsed ? "w-0" : "w-64",
            isMobile ? "chat-mobile-transition" : "transition-all duration-200"
          )}>
            {!isInitialized ? (
              <div className="flex items-center justify-center h-full w-64">
                <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : (
              <ChatSidebar 
                onChannelSelect={handleMobileSidebarAutoClose}
                onDMStart={handleMobileSidebarAutoClose}
              />
            )}
          </div>
          
          {/* Main Chat Area */}
          <div className="min-w-0 overflow-hidden">
            <ChatArea 
              onMessageInputFocus={handleMobileSidebarAutoClose}
            />
          </div>
        </div>
      )}
      
    </Card>
  );
};