
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export const CursorFollower = () => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const updateMousePosition = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
      if (!isVisible) setIsVisible(true);
    };

    const handleMouseLeave = () => {
      setIsVisible(false);
    };

    window.addEventListener('mousemove', updateMousePosition);
    window.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.removeEventListener('mousemove', updateMousePosition);
      window.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [isVisible]);

  return (
    <>
      <motion.div
        className="fixed pointer-events-none z-50 hidden md:block"
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
        className="fixed pointer-events-none z-50 hidden md:block"
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
