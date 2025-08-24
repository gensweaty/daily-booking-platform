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
  const [size, setSize] = useState({ width: 520, height: 560 });
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [resizeType, setResizeType] = useState<'corner' | 'right' | 'bottom' | null>(null);
  
  const cardRef = useRef<HTMLDivElement>(null);
  const { isInitialized } = useChat();

  // Set initial position and size
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      setWindowState('maximized');
      setSize({ width: window.innerWidth, height: window.innerHeight });
      setPosition({ x: 0, y: 0 });
      setIsSidebarCollapsed(true);
    } else {
      const w = Math.min(600, Math.round(window.innerWidth * 0.4));
      const h = Math.min(700, Math.round(window.innerHeight * 0.8));
      setSize({ width: w, height: h });
      setPosition({ x: window.innerWidth - w - 32, y: window.innerHeight - h - 100 });
    }
  }, [isOpen]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== 'undefined') {
        const isMobile = window.innerWidth <= 768;
        
        if (isMobile) {
          setWindowState('maximized');
          setSize({ width: window.innerWidth, height: window.innerHeight });
          setPosition({ x: 0, y: 0 });
          setIsSidebarCollapsed(true);
        } else if (windowState === 'maximized') {
          setSize({ width: window.innerWidth, height: window.innerHeight });
          setPosition({ x: 0, y: 0 });
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [windowState]);

  // Mouse event handlers for dragging and resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y
        });
      }
      
      if (isResizing && resizeType) {
        const deltaX = e.clientX - resizeStart.x;
        const deltaY = e.clientY - resizeStart.y;
        
        let newWidth = resizeStart.width;
        let newHeight = resizeStart.height;
        
        if (resizeType === 'corner' || resizeType === 'right') {
          newWidth = Math.max(400, resizeStart.width + deltaX);
        }
        if (resizeType === 'corner' || resizeType === 'bottom') {
          newHeight = Math.max(300, resizeStart.height + deltaY);
        }
        
        setSize({ width: newWidth, height: newHeight });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      setResizeType(null);
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
    };
  }, [isDragging, isResizing, dragStart, resizeStart, resizeType]);

  const handleDragStart = (e: React.MouseEvent) => {
    if (windowState === 'maximized') return;
    
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
    e.preventDefault();
  };

  const handleResizeStart = (e: React.MouseEvent, type: 'corner' | 'right' | 'bottom') => {
    if (windowState === 'maximized') return;
    
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    setResizeType(type);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height
    });
  };

  const toggleMinimize = () => {
    if (window.innerWidth <= 768) return; // No minimize on mobile
    setWindowState(prev => prev === 'minimized' ? 'normal' : 'minimized');
  };

  const toggleMaximize = () => {
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) return; // Mobile always stays maximized
    
    if (windowState === 'maximized') {
      setWindowState('normal');
      const w = 600;
      const h = 700;
      setSize({ width: w, height: h });
      setPosition({
        x: (window.innerWidth - w) / 2,
        y: (window.innerHeight - h) / 2
      });
    } else {
      setWindowState('maximized');
      setSize({ width: window.innerWidth, height: window.innerHeight });
      setPosition({ x: 0, y: 0 });
    }
  };

  const getWindowStyle = () => {
    switch (windowState) {
      case 'minimized':
        return {
          width: '300px',
          height: '50px',
          transform: `translate(${position.x}px, ${position.y}px)`
        };
      case 'maximized':
        return {
          inset: 0,
          width: '100vw',
          height: '100vh',
          transform: 'none'
        };
      default:
        return {
          width: `${size.width}px`,
          height: `${size.height}px`,
          transform: `translate(${Math.max(0, position.x)}px, ${Math.max(0, position.y)}px)`
        };
    }
  };

  if (!isOpen) return null;

  return (
    <Card
      ref={cardRef}
      className={cn(
        "fixed bg-background border shadow-lg pointer-events-auto transition-all duration-200 z-[9998]",
        "grid grid-rows-[auto,1fr] overflow-hidden",
        windowState === 'maximized' ? 'rounded-none' : 'rounded-lg'
      )}
      style={getWindowStyle()}
    >
      {/* Title Bar */}
      <div
        className={cn(
          "flex items-center justify-between px-4 py-2 border-b bg-muted/50 min-h-[48px]",
          windowState !== 'maximized' ? "cursor-move" : "cursor-default"
        )}
        onMouseDown={windowState !== 'maximized' ? handleDragStart : undefined}
      >
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
      
      {/* Resize Handles - only visible in normal state */}
      {windowState === 'normal' && (
        <>
          {/* Corner resize handle */}
          <div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-[9999] hover:bg-primary/20 bg-muted/40"
            onMouseDown={(e) => handleResizeStart(e, 'corner')}
          >
            <div className="absolute bottom-1 right-1 w-3 h-3 border-r-2 border-b-2 border-muted-foreground/60"></div>
          </div>
          
          {/* Right resize handle */}
          <div
            className="absolute top-12 right-0 w-2 h-[calc(100%-48px)] cursor-e-resize z-[9999] hover:bg-primary/20"
            onMouseDown={(e) => handleResizeStart(e, 'right')}
          />
          
          {/* Bottom resize handle */}
          <div
            className="absolute bottom-0 left-0 w-full h-2 cursor-s-resize z-[9999] hover:bg-primary/20"
            onMouseDown={(e) => handleResizeStart(e, 'bottom')}
          />
        </>
      )}
    </Card>
  );
};