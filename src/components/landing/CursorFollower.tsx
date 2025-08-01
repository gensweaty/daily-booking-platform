
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export const CursorFollower = () => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    console.log("CursorFollower mounted");
    
    const updateMousePosition = (e: MouseEvent) => {
      console.log("Mouse moving:", e.clientX, e.clientY);
      setMousePosition({ x: e.clientX, y: e.clientY });
      if (!isVisible) setIsVisible(true);
    };

    const handleMouseLeave = () => {
      setIsVisible(false);
    };

    const handleMouseEnter = () => {
      setIsVisible(true);
    };

    // Add event listeners to both window and document to ensure coverage
    document.addEventListener('mousemove', updateMousePosition, { passive: true });
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseenter', handleMouseEnter);
    window.addEventListener('mousemove', updateMousePosition, { passive: true });

    return () => {
      document.removeEventListener('mousemove', updateMousePosition);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseenter', handleMouseEnter);
      window.removeEventListener('mousemove', updateMousePosition);
    };
  }, [isVisible]);

  return (
    <>
      <motion.div
        className="fixed pointer-events-none z-[9999] block"
        style={{
          left: 0,
          top: 0,
          position: 'fixed'
        }}
        animate={{
          x: mousePosition.x - 16,
          y: mousePosition.y - 16,
          opacity: isVisible ? 1 : 0,
          scale: isVisible ? 1 : 0.8,
        }}
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
        className="fixed pointer-events-none z-[9999] block"
        style={{
          left: 0,
          top: 0,
          position: 'fixed'
        }}
        animate={{
          x: mousePosition.x - 4,
          y: mousePosition.y - 4,
          opacity: isVisible ? 1 : 0,
          scale: isVisible ? 1 : 0.8,
        }}
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
