
import React from 'react';
import { getGeorgianFontStyle } from '@/lib/font-utils';

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
  
  const georgianStyle = getGeorgianFontStyle();
  
  return (
    <span 
      className={`georgian-auth-text georgian-bold-fix georgian-text-fix ${className}`}
      style={{
        ...georgianStyle,
        fontWeight: fontWeightValue
      }}
    >
      {children}
    </span>
  );
};
