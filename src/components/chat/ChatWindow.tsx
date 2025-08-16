import { useState, useRef, useEffect } from 'react';
import { X, Minus, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ChatSidebar } from './ChatSidebar';
import { ChatArea } from './ChatArea';
import { useChat } from '@/hooks/useChat';

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

  // Initialize position to bottom-right
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPosition({
        x: window.innerWidth - size.width - 120,
        y: window.innerHeight - size.height - 120
      });
    }
  }, []);

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
        const newWidth = Math.max(400, resizeStart.width + (e.clientX - resizeStart.x));
        const newHeight = Math.max(300, resizeStart.height + (e.clientY - resizeStart.y));
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
    setWindowState(windowState === 'minimized' ? 'normal' : 'minimized');
  };

  const toggleMaximize = () => {
    setWindowState(windowState === 'maximized' ? 'normal' : 'maximized');
  };

  if (!isOpen || !chat.hasSubUsers || !chat.isInitialized) {
    console.log('💬 ChatWindow not rendering:', { 
      isOpen, 
      hasSubUsers: chat.hasSubUsers, 
      isInitialized: chat.isInitialized,
      reason: !isOpen ? 'not open' : !chat.hasSubUsers ? 'no sub users' : 'not initialized'
    });
    return null;
  }

  console.log('✅ ChatWindow rendering successfully:', { isOpen, hasSubUsers: chat.hasSubUsers, isInitialized: chat.isInitialized });

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
          width: '100vw',
          height: '100vh',
          transform: 'translate(0, 0)',
          top: 0,
          left: 0
        };
      default:
        return {
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
        "fixed z-50 overflow-hidden shadow-2xl border-border bg-background transition-all duration-200",
        windowState === 'maximized' ? 'rounded-none' : 'rounded-lg',
        isDragging ? 'cursor-grabbing' : 'cursor-auto'
      )}
      style={getWindowStyle()}
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
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleMinimize}
            className="h-6 w-6 p-0 hover:bg-muted"
          >
            <Minus className="h-3 w-3" />
          </Button>
          
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
      {windowState !== 'minimized' && (
        <div className="flex h-full">
          <ChatSidebar />
          <ChatArea />
        </div>
      )}

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