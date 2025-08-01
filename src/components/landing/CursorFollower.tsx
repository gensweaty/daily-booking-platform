
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export const CursorFollower = () => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    console.log("CursorFollower mounted");
    
    let animationFrameId: number;
    
    const updateMousePosition = (e: MouseEvent) => {
      // Cancel previous animation frame to avoid redundant updates
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      
      animationFrameId = requestAnimationFrame(() => {
        console.log("Mouse moving:", e.clientX, e.clientY);
        setMousePosition({ x: e.clientX, y: e.clientY });
        if (!isVisible) {
          setIsVisible(true);
        }
      });
    };

    const handleMouseLeave = () => {
      setIsVisible(false);
    };

    const handleMouseEnter = () => {
      setIsVisible(true);
    };

    // Use only window events for more consistent tracking
    window.addEventListener('mousemove', updateMousePosition, { passive: true });
    window.addEventListener('mouseleave', handleMouseLeave, { passive: true });
    window.addEventListener('mouseenter', handleMouseEnter, { passive: true });

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      window.removeEventListener('mousemove', updateMousePosition);
      window.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('mouseenter', handleMouseEnter);
    };
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <>
      <motion.div
        className="fixed pointer-events-none z-[9999]"
        style={{
          left: mousePosition.x - 16,
          top: mousePosition.y - 16,
        }}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ 
          opacity: 1, 
          scale: 1 
        }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{
          type: "spring",
          mass: 0.2,
          stiffness: 100,
          damping: 15,
        }}
      >
        <div className="w-8 h-8 bg-gradient-to-r from-primary/30 to-accent/30 rounded-full blur-sm" />
      </motion.div>
      <motion.div
        className="fixed pointer-events-none z-[9999]"
        style={{
          left: mousePosition.x - 4,
          top: mousePosition.y - 4,
        }}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ 
          opacity: 1, 
          scale: 1 
        }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{
          type: "spring",
          mass: 0.1,
          stiffness: 150,
          damping: 10,
        }}
      >
        <div className="w-2 h-2 bg-primary rounded-full" />
      </motion.div>
    </>
  );
};
