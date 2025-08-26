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
  const [windowState, setWindowState] = useState<WindowState>('minimized');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  const cardRef = useRef<HTMLDivElement>(null);
  const { isInitialized } = useChat();

  // Set mobile state on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      setWindowState('maximized');
      setIsSidebarCollapsed(true);
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
      bottom: '100px',
      right: '24px'
    };
    
    switch (windowState) {
      case 'minimized':
        return {
          ...baseStyle,
          width: '300px',
          height: '50px'
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
          width: '600px',
          height: '700px'
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
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/50 min-h-[48px]">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="h-6 w-6 p-0"
            title="Toggle Sidebar"
          >
            <Menu className="h-3 w-3" />
          </Button>
          <span className="font-medium text-sm">Team Chat</span>
        </div>
        
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleMinimize}
            className="h-6 w-6 p-0 hover:bg-muted"
            title={windowState === 'minimized' ? 'Restore' : 'Minimize'}
            disabled={window.innerWidth <= 768}
          >
            <Minus className="h-3 w-3" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleMaximize}
            className="h-6 w-6 p-0 hover:bg-muted"
            title={windowState === 'maximized' ? 'Restore Down' : 'Maximize'}
            disabled={window.innerWidth <= 768}
          >
            {windowState === 'maximized' ? (
              <Minimize2 className="h-3 w-3" />
            ) : (
              <Maximize2 className="h-3 w-3" />
            )}
          </Button>
          
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