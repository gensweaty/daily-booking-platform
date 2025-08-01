
import { useEffect, useState } from 'react';

export const CursorFollower = () => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    console.log("CursorFollower mounted");
    let animationId: number;
    
    const updateMousePosition = (e: MouseEvent) => {
      // Cancel any pending animation frame
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      
      // Use requestAnimationFrame for smooth updates
      animationId = requestAnimationFrame(() => {
        setMousePosition({ x: e.clientX, y: e.clientY });
        if (!isVisible) setIsVisible(true);
      });
    };

    const handleMouseLeave = () => {
      setIsVisible(false);
    };

    const handleMouseEnter = () => {
      setIsVisible(true);
    };

    // Use document for better event capture across all elements
    document.addEventListener('mousemove', updateMousePosition, { passive: true });
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseenter', handleMouseEnter);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      document.removeEventListener('mousemove', updateMousePosition);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseenter', handleMouseEnter);
    };
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <>
      {/* Outer blur circle */}
      <div
        className="fixed pointer-events-none z-[9999] transition-opacity duration-200 ease-out"
        style={{
          left: mousePosition.x - 16,
          top: mousePosition.y - 16,
          transform: 'translate3d(0, 0, 0)', // Hardware acceleration
          opacity: isVisible ? 1 : 0,
        }}
      >
        <div className="w-8 h-8 bg-gradient-to-r from-primary/30 to-accent/30 rounded-full blur-sm" />
      </div>
      
      {/* Inner dot */}
      <div
        className="fixed pointer-events-none z-[9999] transition-opacity duration-150 ease-out"
        style={{
          left: mousePosition.x - 4,
          top: mousePosition.y - 4,
          transform: 'translate3d(0, 0, 0)', // Hardware acceleration
          opacity: isVisible ? 1 : 0,
        }}
      >
        <div className="w-2 h-2 bg-primary rounded-full" />
      </div>
    </>
  );
};
