
import React from 'react';
import { cn } from '@/lib/utils';

interface GeorgianAuthTextProps {
  children: React.ReactNode;
  className?: string;
}

export const GeorgianAuthText = ({ children, className = '' }: GeorgianAuthTextProps) => {
  // This component specifically targets Georgian text in the UI
  // with all the styling needed to ensure proper rendering of bold text
  return (
    <span 
      className={cn('georgian-auth-text font-bold', className)}
      style={{
        fontFamily: "'BPG Glaho WEB Caps', 'DejaVu Sans', 'Arial Unicode MS', sans-serif",
        letterSpacing: '-0.2px',
        fontWeight: 'bold', // Ensure bold is explicitly set
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        textRendering: 'optimizeLegibility'
      }}
    >
      {children}
    </span>
  );
};
