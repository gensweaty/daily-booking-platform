
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export const CursorFollower = () => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    console.log("CursorFollower mounted");
    
    const updateMousePosition = (e: MouseEvent) => {
      console.log("Mouse moving:", e.clientX, e.clientY);
      // Update position immediately without requestAnimationFrame
      setMousePosition({ x: e.clientX, y: e.clientY });
      if (!isVisible) {
        setIsVisible(true);
      }
    };

    const handleMouseLeave = () => {
      console.log("Mouse left viewport");
      setIsVisible(false);
    };

    const handleMouseEnter = () => {
      console.log("Mouse entered viewport");
      setIsVisible(true);
    };

    // Use document.body for more reliable tracking across the entire page
    document.body.addEventListener('mousemove', updateMousePosition, { passive: true });
    document.addEventListener('mouseleave', handleMouseLeave, { passive: true });
    document.addEventListener('mouseenter', handleMouseEnter, { passive: true });

    return () => {
      document.body.removeEventListener('mousemove', updateMousePosition);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseenter', handleMouseEnter);
    };
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <>
      {/* Outer glow */}
      <motion.div
        className="fixed pointer-events-none z-[9999]"
        style={{
          left: mousePosition.x - 16,
          top: mousePosition.y - 16,
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.1 }}
      >
        <div className="w-8 h-8 bg-gradient-to-r from-primary/30 to-accent/30 rounded-full blur-sm" />
      </motion.div>
      
      {/* Inner dot */}
      <motion.div
        className="fixed pointer-events-none z-[9999]"
        style={{
          left: mousePosition.x - 4,
          top: mousePosition.y - 4,
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.1 }}
      >
        <div className="w-2 h-2 bg-primary rounded-full" />
      </motion.div>
    </>
  );
};
