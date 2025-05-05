
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
  
  // Get our consistent Georgian font style and add fontWeight
  const fontStyle = {
    ...getGeorgianFontStyle(),
    fontWeight: fontWeightValue
  };
  
  return (
    <span 
      className={`georgian-auth-text georgian-bold-fix georgian-text-fix ${className}`}
      style={fontStyle}
    >
      {children}
    </span>
  );
};
