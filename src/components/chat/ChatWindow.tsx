import { useState, useRef, useEffect } from 'react';
import { X, Minus, Maximize2, Minimize2, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ChatSidebar } from './ChatSidebar';
import { ChatArea } from './ChatArea';
import { useChat } from './ChatProvider';

interface ChatWindowProps {
  isOpen: boolean;
  onClose: () => void;
}

type WindowState = 'normal' | 'minimized' | 'maximized';

export const ChatWindow = ({ isOpen, onClose }: ChatWindowProps) => {
  const [windowState, setWindowState] = useState<WindowState>('normal');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  const cardRef = useRef<HTMLDivElement>(null);
  const { isInitialized } = useChat();

  // Set state on mount - minimized on first open for desktop, maximized for mobile
  useEffect(() => {
    if (typeof window === 'undefined' || !isOpen) return;
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      setWindowState('maximized');
      setIsSidebarCollapsed(true);
    } else {
      setWindowState('minimized');
    }
  }, [isOpen]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== 'undefined') {
        const isMobile = window.innerWidth <= 768;
        if (isMobile) {
          setWindowState('maximized');
          setIsSidebarCollapsed(true);
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);


  const toggleMinimize = () => {
    if (window.innerWidth <= 768) return; // No minimize on mobile
    setWindowState(prev => prev === 'minimized' ? 'normal' : 'minimized');
  };

  const toggleMaximize = () => {
    const isMobile = window.innerWidth <= 768;
    if (isMobile) return; // Mobile always stays maximized
    
    setWindowState(prev => prev === 'maximized' ? 'normal' : 'maximized');
  };

  const getWindowStyle = (): React.CSSProperties => {
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
      return {
        inset: 0,
        width: '100vw',
        height: '100vh'
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
          height: '56px' // Increased to accommodate title bar properly
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
        "fixed bg-background border shadow-lg pointer-events-auto transition-all duration-300 z-[9998]",
        "grid grid-rows-[auto,1fr] overflow-hidden",
        windowState === 'maximized' ? 'rounded-none' : 'rounded-lg'
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
              className="h-6 w-6 p-0 shrink-0"
              title="Toggle Sidebar"
            >
              <Menu className="h-3 w-3" />
            </Button>
          )}
          <span className="font-medium text-sm truncate">Team Chat</span>
        </div>
        
        <div className="flex items-center gap-1 shrink-0">
          {window.innerWidth > 768 && (
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
      {windowState !== 'minimized' && (
        <div className="grid grid-cols-[auto,1fr] overflow-hidden min-h-0">
          {/* Sidebar */}
          <div className={cn(
            "border-r transition-all duration-200 overflow-hidden bg-muted/20",
            isSidebarCollapsed ? "w-0" : "w-64"
          )}>
            {!isInitialized ? (
              <div className="flex items-center justify-center h-full w-64">
                <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : (
              <ChatSidebar />
            )}
          </div>
          
          {/* Main Chat Area */}
          <div className="min-w-0 overflow-hidden">
            <ChatArea />
          </div>
        </div>
      )}
      
    </Card>
  );
};