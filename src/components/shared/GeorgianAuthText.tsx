
import React from 'react';
import { getEnhancedGeorgianFontStyle } from '@/lib/font-utils';
import { cn } from '@/lib/utils';

interface GeorgianAuthTextProps {
  children: React.ReactNode;
  className?: string;
  fontWeight?: 'normal' | 'bold' | 'semibold' | 'medium';
  letterSpacing?: string;
}

export const GeorgianAuthText = ({ 
  children, 
  className = '',
  fontWeight = 'normal',
  letterSpacing = '-0.2px'
}: GeorgianAuthTextProps) => {
  // This component specifically targets Georgian text
  // with all the styling needed to ensure proper rendering
  
  // Get enhanced Georgian font style with options
  const fontStyle = getEnhancedGeorgianFontStyle({
    fontWeight,
    letterSpacing
  });
  
  return (
    <span 
      className={cn(`georgian-auth-text georgian-bold-fix georgian-text-fix ${className}`)}
      style={fontStyle}
    >
      {children}
    </span>
  );
};
