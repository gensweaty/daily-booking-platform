
import React from 'react';
import { getGeorgianFontStyle } from '@/lib/font-utils';

interface GeorgianAuthTextProps {
  children: React.ReactNode;
  fontWeight?: 'normal' | 'medium' | 'bold';
  letterSpacing?: string;
}

export const GeorgianAuthText: React.FC<GeorgianAuthTextProps> = ({ 
  children, 
  fontWeight = 'normal',
  letterSpacing 
}) => {
  const fontStyle = getGeorgianFontStyle();
  
  // Add letterSpacing to the font style if provided
  const combinedStyle = {
    ...fontStyle,
    ...(letterSpacing ? { letterSpacing } : {})
  };

  let fontWeightStyle;
  switch (fontWeight) {
    case 'normal':
      fontWeightStyle = 'font-normal';
      break;
    case 'medium':
      fontWeightStyle = 'font-medium';
      break;
    case 'bold':
      fontWeightStyle = 'font-bold';
      break;
    default:
      fontWeightStyle = 'font-normal';
      break;
  }

  return (
    <span style={combinedStyle} className={fontWeightStyle}>
      {children}
    </span>
  );
};
