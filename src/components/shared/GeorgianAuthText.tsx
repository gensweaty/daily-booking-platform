import React from 'react';
import { getGeorgianFontStyle } from '@/lib/font-utils';

interface GeorgianAuthTextProps {
  children: React.ReactNode;
  fontWeight?: 'normal' | 'medium' | 'bold';
}

export const GeorgianAuthText: React.FC<GeorgianAuthTextProps> = ({ children, fontWeight = 'normal' }) => {
  const fontStyle = getGeorgianFontStyle();

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
    <span style={fontStyle} className={fontWeightStyle}>
      {children}
    </span>
  );
};
