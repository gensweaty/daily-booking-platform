
import { useEffect, useState, useRef } from 'react';

export const CursorFollower = () => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const rafRef = useRef<number>();
  const lastPositionRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    console.log("CursorFollower mounted");
    
    const updateMousePosition = (e: MouseEvent) => {
      // Cancel any pending animation frame
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      
      // Store the latest mouse position
      lastPositionRef.current = { x: e.clientX, y: e.clientY };
      
      // Use requestAnimationFrame for smooth updates
      rafRef.current = requestAnimationFrame(() => {
        setMousePosition({ x: lastPositionRef.current.x, y: lastPositionRef.current.y });
        if (!isVisible) setIsVisible(true);
      });
    };

    const handleMouseLeave = () => {
      setIsVisible(false);
    };

    const handleMouseEnter = () => {
      setIsVisible(true);
    };

    // Add event listeners to document.body for better coverage
    document.body.addEventListener('mousemove', updateMousePosition, { passive: true });
    document.body.addEventListener('mouseleave', handleMouseLeave);
    document.body.addEventListener('mouseenter', handleMouseEnter);
    
    // Also add to window as fallback
    window.addEventListener('mousemove', updateMousePosition, { passive: true });

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      document.body.removeEventListener('mousemove', updateMousePosition);
      document.body.removeEventListener('mouseleave', handleMouseLeave);
      document.body.removeEventListener('mouseenter', handleMouseEnter);
      window.removeEventListener('mousemove', updateMousePosition);
    };
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <>
      {/* Outer blur circle */}
      <div
        className="fixed pointer-events-none z-[9999]"
        style={{
          left: mousePosition.x - 16,
          top: mousePosition.y - 16,
          width: '32px',
          height: '32px',
          willChange: 'transform',
        }}
      >
        <div className="w-8 h-8 bg-gradient-to-r from-primary/30 to-accent/30 rounded-full blur-sm" />
      </div>
      
      {/* Inner dot */}
      <div
        className="fixed pointer-events-none z-[9999]"
        style={{
          left: mousePosition.x - 4,
          top: mousePosition.y - 4,
          width: '8px',
          height: '8px',
          willChange: 'transform',
        }}
      >
        <div className="w-2 h-2 bg-primary rounded-full" />
      </div>
    </>
  );
};
