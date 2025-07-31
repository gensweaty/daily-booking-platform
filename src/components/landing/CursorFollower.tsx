
import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useMediaQuery } from "@/hooks/useMediaQuery";

export const CursorFollower = () => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const isMobile = useMediaQuery("(max-width: 768px)");

  // Throttle mouse movement for better performance
  const throttleMouseMove = useCallback((callback: Function, delay: number) => {
    let timeoutId: NodeJS.Timeout;
    let lastExecTime = 0;
    
    return (...args: any[]) => {
      const currentTime = Date.now();
      
      if (currentTime - lastExecTime > delay) {
        callback(...args);
        lastExecTime = currentTime;
      } else {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          callback(...args);
          lastExecTime = Date.now();
        }, delay - (currentTime - lastExecTime));
      }
    };
  }, []);

  useEffect(() => {
    // Don't render on mobile devices for better performance
    if (isMobile) {
      setIsVisible(false);
      return;
    }

    console.log("CursorFollower mounted - desktop only");
    
    const updateMousePosition = throttleMouseMove((e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
      if (!isVisible) setIsVisible(true);
    }, 16); // 60fps throttling

    const handleMouseLeave = () => {
      setIsVisible(false);
    };

    window.addEventListener('mousemove', updateMousePosition);
    window.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.removeEventListener('mousemove', updateMousePosition);
      window.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [isVisible, isMobile, throttleMouseMove]);

  // Don't render anything on mobile
  if (isMobile) {
    return null;
  }

  return (
    <>
      <motion.div
        className="fixed pointer-events-none z-50 hidden md:block"
        animate={{
          x: mousePosition.x - 12,
          y: mousePosition.y - 12,
          opacity: isVisible ? 1 : 0,
          scale: isVisible ? 1 : 0.8,
        }}
        transition={{
          type: "spring",
          mass: 0.3,
          stiffness: 80,
          damping: 20,
        }}
      >
        <div className="w-6 h-6 bg-gradient-to-r from-primary/20 to-accent/20 rounded-full blur-sm" />
      </motion.div>
      <motion.div
        className="fixed pointer-events-none z-50 hidden md:block"
        animate={{
          x: mousePosition.x - 2,
          y: mousePosition.y - 2,
          opacity: isVisible ? 1 : 0,
          scale: isVisible ? 1 : 0.8,
        }}
        transition={{
          type: "spring",
          mass: 0.1,
          stiffness: 120,
          damping: 15,
        }}
      >
        <div className="w-1 h-1 bg-primary/80 rounded-full" />
      </motion.div>
    </>
  );
};
