
import React from 'react';

interface GeorgianAuthTextProps {
  children: React.ReactNode;
  className?: string;
}

export const GeorgianAuthText = ({ children, className = '' }: GeorgianAuthTextProps) => {
  // This component specifically targets Georgian text in the Auth UI
  // with all the styling needed to ensure proper rendering
  return (
    <span 
      className={`georgian-fix-text ${className}`}
      style={{
        fontFamily: "'BPG Glaho WEB Caps', 'DejaVu Sans', 'Arial Unicode MS', sans-serif",
        letterSpacing: '-0.2px',
        fontWeight: 'normal',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        textRendering: 'optimizeLegibility'
      }}
    >
      {children}
    </span>
  );
};
