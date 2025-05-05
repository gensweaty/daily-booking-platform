
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
  // Map fontWeight prop to actual CSS value
  const fontWeightValue = 
    fontWeight === 'bold' ? 'bold' : 
    fontWeight === 'semibold' ? '600' :
    fontWeight === 'medium' ? '500' :
    'normal';
  
  const georgianStyle = {
    ...getGeorgianFontStyle(),
    fontWeight: fontWeightValue,
  };
  
  return (
    <span 
      className={`georgian-auth-text georgian-bold-fix georgian-text-fix georgian-button-fix ${className}`}
      style={georgianStyle}
    >
      {children}
    </span>
  );
};
