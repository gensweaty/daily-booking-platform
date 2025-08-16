import { useState, useRef, useEffect } from 'react';
import { X, Minus, Maximize2, Minimize2 } from 'lucide-react';
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
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  
  const windowRef = useRef<HTMLDivElement>(null);
  const chat = useChat();

  // Initialize position and responsive size
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isMobile = window.innerWidth <= 768;
      
      if (isMobile) {
        // Mobile: always maximized (full screen)
        setWindowState('maximized');
        setSize({ width: window.innerWidth, height: window.innerHeight });
        setPosition({ x: 0, y: 0 });
      } else {
        // Desktop: start maximized, but allow normal state
        setWindowState('maximized');
        setSize({ width: window.innerWidth, height: window.innerHeight });
        setPosition({ x: 0, y: 0 });
      }
    }
  }, [isOpen]);

  // Handle window resize for responsiveness
  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== 'undefined') {
        const isMobile = window.innerWidth <= 768;
        
        if (isMobile) {
          // Force mobile to always be maximized
          setWindowState('maximized');
          setSize({ width: window.innerWidth, height: window.innerHeight });
          setPosition({ x: 0, y: 0 });
        } else if (windowState === 'maximized') {
          // Keep desktop maximized responsive
          setSize({ width: window.innerWidth, height: window.innerHeight });
          setPosition({ x: 0, y: 0 });
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [windowState]);

  // Handle mouse events for dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y
        });
      }
      
      if (isResizing) {
        const isMobile = window.innerWidth < 768;
        const minWidth = isMobile ? 300 : 400;
        const minHeight = isMobile ? 250 : 300;
        const newWidth = Math.max(minWidth, resizeStart.width + (e.clientX - resizeStart.x));
        const newHeight = Math.max(minHeight, resizeStart.height + (e.clientY - resizeStart.y));
        setSize({ width: newWidth, height: newHeight });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, dragStart, resizeStart]);

  const handleDragStart = (e: React.MouseEvent) => {
    if (windowState === 'maximized') return;
    
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    if (windowState === 'maximized') return;
    
    e.stopPropagation();
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height
    });
  };

  const toggleMinimize = () => {
    // Don't allow minimize on mobile
    if (window.innerWidth <= 768) return;
    setWindowState(windowState === 'minimized' ? 'normal' : 'minimized');
  };

  const toggleMaximize = () => {
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
      // Mobile always stays maximized
      return;
    }
    
    if (windowState === 'maximized') {
      // Desktop: return to normal windowed mode
      const normalSize = { 
        width: Math.min(1000, window.innerWidth - 100), 
        height: Math.min(700, window.innerHeight - 100) 
      };
      setSize(normalSize);
      setPosition({
        x: (window.innerWidth - normalSize.width) / 2,
        y: (window.innerHeight - normalSize.height) / 2
      });
      setWindowState('normal');
    } else {
      // Desktop: maximize
      setWindowState('maximized');
      setSize({ width: window.innerWidth, height: window.innerHeight });
      setPosition({ x: 0, y: 0 });
    }
  };

  if (!isOpen) {
    console.log('💬 ChatWindow not open');
    return null;
  }

  console.log('✅ ChatWindow rendering:', { isOpen, hasSubUsers: chat.hasSubUsers, isInitialized: chat.isInitialized });

  const content = !chat.hasSubUsers ? (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground p-4">
      Chat is available once you add at least one sub-user.
    </div>
  ) : !chat.isInitialized ? (
    <div className="flex h-full items-center justify-center">
      <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
    </div>
  ) : (
    <div className="flex h-full">
      <ChatSidebar />
      <ChatArea />
    </div>
  );

  const getWindowStyle = () => {
    const isMobile = window.innerWidth <= 768;
    
    switch (windowState) {
      case 'minimized':
        // Don't allow minimize on mobile
        if (isMobile) {
          return {
            position: 'fixed' as const,
            inset: 0,
            width: '100vw',
            height: '100vh',
            transform: 'none'
          };
        }
        return {
          position: 'fixed' as const,
          width: '300px',
          height: '50px',
          transform: `translate(${position.x}px, ${position.y}px)`
        };
      case 'maximized':
        return {
          position: 'fixed' as const,
          inset: 0,
          width: '100vw',
          height: '100vh',
          transform: 'none'
        };
      default:
        return {
          position: 'fixed' as const,
          width: `${size.width}px`,
          height: `${size.height}px`,
          transform: `translate(${position.x}px, ${position.y}px)`
        };
    }
  };

  return (
    <Card
      ref={windowRef}
      className={cn(
        "fixed z-[9998] overflow-hidden shadow-2xl border-border bg-background transition-all duration-200",
        windowState === 'maximized' ? 'rounded-none' : 'rounded-lg',
        isDragging ? 'cursor-grabbing' : 'cursor-auto',
        // Mobile responsive classes
        "md:min-w-[400px] min-w-[300px]"
      )}
      style={{ ...getWindowStyle(), zIndex: 9998 }}
    >
      {/* Title Bar */}
      <div
        className={cn(
          "flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border",
          windowState !== 'maximized' && 'cursor-grab active:cursor-grabbing'
        )}
        onMouseDown={handleDragStart}
      >
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span className="ml-2 text-sm font-medium text-foreground">
            Team Chat
          </span>
        </div>
        
        <div className="flex items-center gap-1">
          {/* Hide minimize button on mobile */}
          {typeof window !== 'undefined' && window.innerWidth > 768 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleMinimize}
              className="h-6 w-6 p-0 hover:bg-muted"
            >
              <Minus className="h-3 w-3" />
            </Button>
          )}
          
          {/* Hide maximize/minimize button on mobile as it should always be fullscreen */}
          {typeof window !== 'undefined' && window.innerWidth > 768 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleMaximize}
              className="h-6 w-6 p-0 hover:bg-muted"
            >
              {windowState === 'maximized' ? (
                <Minimize2 className="h-3 w-3" />
              ) : (
                <Maximize2 className="h-3 w-3" />
              )}
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Chat Content */}
      {windowState !== 'minimized' && content}

      {/* Resize Handle */}
      {windowState === 'normal' && (
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize bg-muted/50 hover:bg-muted"
          onMouseDown={handleResizeStart}
        >
          <div className="absolute bottom-1 right-1 w-0 h-0 border-l-2 border-t-2 border-muted-foreground/50" />
        </div>
      )}
    </Card>
  );
};