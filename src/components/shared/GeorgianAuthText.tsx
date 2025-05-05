
import React from 'react';

interface GeorgianAuthTextProps {
  children: React.ReactNode;
  className?: string;
  fontWeight?: 'normal' | 'bold' | 'semibold' | 'medium';
}

export const GeorgianAuthText = ({ 
  children, 
  className = '',
  fontWeight = 'normal'
}: GeorgianAuthTextProps) => {
  // This component specifically targets Georgian text
  // with all the styling needed to ensure proper rendering
  
  // Map fontWeight prop to actual CSS value
  const fontWeightValue = 
    fontWeight === 'bold' ? 'bold' : 
    fontWeight === 'semibold' ? '600' :
    fontWeight === 'medium' ? '500' :
    'normal';
  
  return (
    <span 
      className={`georgian-auth-text georgian-bold-fix georgian-text-fix ${className}`}
      style={{
        fontFamily: "'BPG Glaho WEB Caps', 'DejaVu Sans', 'Arial Unicode MS', sans-serif",
        letterSpacing: '-0.2px',
        fontWeight: fontWeightValue,
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        textRendering: 'optimizeLegibility'
      }}
    >
      {children}
    </span>
  );
};
