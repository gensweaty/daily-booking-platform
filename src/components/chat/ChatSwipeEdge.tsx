import { useRef, useCallback } from 'react';
import { useMediaQuery } from '@/hooks/useMediaQuery';

interface ChatSwipeEdgeProps {
  onSwipeLeft: () => void;
}

/**
 * Invisible touch zone on the right edge of the screen.
 * Swiping left from this zone opens the chat on mobile.
 */
export const ChatSwipeEdge = ({ onSwipeLeft }: ChatSwipeEdgeProps) => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (startX.current === null || startY.current === null) return;
    const deltaX = e.touches[0].clientX - startX.current;
    const deltaY = e.touches[0].clientY - startY.current;

    // Swipe left at least 40px, predominantly horizontal
    if (deltaX < -40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      startX.current = null;
      startY.current = null;
      onSwipeLeft();
    }
  }, [onSwipeLeft]);

  const handleTouchEnd = useCallback(() => {
    startX.current = null;
    startY.current = null;
  }, []);

  if (!isMobile) return null;

  return (
    <div
      className="fixed top-0 right-0 w-5 pointer-events-auto z-[50]"
      style={{ height: '100dvh' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      aria-hidden="true"
    />
  );
};
