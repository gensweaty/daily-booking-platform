import { useState, useRef, useEffect } from 'react';
import { X, Minus, Maximize2, Minimize2, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ChatSidebar } from './ChatSidebar';
import { ChatArea } from './ChatArea';
import { useChatSafe } from './ChatProvider';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageText } from '@/components/shared/LanguageText';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useVisualViewport } from '@/hooks/useVisualViewport';
import './mobile-chat.css';

interface ChatWindowProps {
  isOpen: boolean;
  onClose: () => void;
}

type WindowState = 'normal' | 'minimized' | 'maximized';

export const ChatWindow = ({ isOpen, onClose }: ChatWindowProps) => {
  const { t } = useLanguage();
  const cardRef = useRef<HTMLDivElement>(null);
  const chatContext = useChatSafe();
  const isMobile = useMediaQuery('(max-width: 768px)');
  // Use VisualViewport sizing on mobile to avoid “paddingBottom gap” issues when the keyboard opens.
  // Only listen while the chat is open on mobile to minimize side-effects/perf cost.
  const vv = useVisualViewport({ enabled: isMobile && isOpen });
  
  // CRITICAL: Initialize state based on screen size immediately to prevent layout flash
  // Use a function to ensure correct initial state on first render
  const [windowState, setWindowState] = useState<WindowState>(() => {
    // Check if mobile on initial render (SSR-safe check)
    if (typeof window !== 'undefined') {
      return window.matchMedia('(max-width: 768px)').matches ? 'maximized' : 'normal';
    }
    return 'normal';
  });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    // Sidebar collapsed by default on mobile
    if (typeof window !== 'undefined') {
      return window.matchMedia('(max-width: 768px)').matches;
    }
    return false;
  });
  
  // Track if initial layout has been set to prevent flicker
  const [isLayoutReady, setIsLayoutReady] = useState(false);
  
  // Extract isInitialized safely (use fallback if context is null)
  const isInitialized = chatContext?.isInitialized ?? false;

  // Sync window state with screen size changes (responsive behavior)
  // ALL HOOKS MUST BE BEFORE ANY CONDITIONAL RETURNS
  useEffect(() => {
    if (!isOpen) return;
    
    // Mark layout as ready after first render with correct state
    if (!isLayoutReady) {
      setIsLayoutReady(true);
    }
    
    if (isMobile) {
      setWindowState('maximized');
      setIsSidebarCollapsed(true);
    } else {
      setWindowState('normal');
    }
  }, [isOpen, isMobile, isLayoutReady]);

  // If context is not available, don't render (AFTER all hooks)
  if (!chatContext) {
    return null;
  }

  // Auto-close sidebar on mobile when typing
  const handleMobileSidebarAutoClose = () => {
    if (isMobile && !isSidebarCollapsed) {
      setIsSidebarCollapsed(true);
    }
  };


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
      // IMPORTANT: Avoid paddingBottom keyboard hacks.
      // Instead, size the window to the *visual viewport*, which shrinks when the keyboard opens.
      // This prevents the input area from jumping upward leaving a large gap.
      const height = vv.height || (typeof window !== 'undefined' ? window.innerHeight : 0);
      const offsetTop = vv.offsetTop || 0;

      return {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: height > 0 ? `${height}px` : '100dvh',
        transform: offsetTop ? `translateY(${offsetTop}px)` : undefined,
        paddingTop: 'env(safe-area-inset-top, 0px)'
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
          width: 'min(400px, calc(100vw - 16px))',
          height: 'min(300px, calc(100vh - 100px))'
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
        "fixed bg-background border shadow-lg pointer-events-auto z-[12001]",
        "grid grid-rows-[auto,1fr] overflow-hidden",
        windowState === 'maximized' ? 'rounded-none' : 'rounded-lg',
        isMobile ? 'chat-mobile-transition chat-mobile-viewport chat-container-mobile' : 'transition-all duration-300'
      )}
      style={getWindowStyle()}
    >
      {/* Title Bar */}
      <div className={cn(
        "flex items-center justify-between px-3 py-2 border-b bg-muted/50",
        "min-h-[52px] shrink-0", // Consistent height with better spacing
        windowState === 'minimized' ? "h-[52px]" : "" // Fixed height when minimized
      )}>
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

      {/* Chat Content */}
      <div className={cn(
        "grid overflow-hidden min-h-0",
        windowState === 'minimized' ? "grid-cols-1" : "grid-cols-[auto,1fr]"
      )}>
        {/* Sidebar - hidden when minimized */}
        {windowState !== 'minimized' && (
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
        )}
        
        {/* Main Chat Area - always visible, compact when minimized */}
        <div className={cn(
          "min-w-0 overflow-hidden",
          windowState === 'minimized' && "flex flex-col"
        )}>
          <ChatArea 
            onMessageInputFocus={handleMobileSidebarAutoClose}
            isMinimized={windowState === 'minimized'}
          />
        </div>
      </div>
      
    </Card>
  );
};