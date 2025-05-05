
import React from 'react';
import { getGeorgianFontStyle } from '@/lib/font-utils';
import { cn } from '@/lib/utils';

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
  
  const baseStyles = getGeorgianFontStyle();
  
  return (
    <span 
      className={cn("georgian-auth-text georgian-bold-fix georgian-text-fix", className)}
      style={{
        ...baseStyles,
        fontWeight: fontWeightValue,
        fontFeatureSettings: '"case" 0', // Disable case-sensitive forms
        textTransform: 'none', // Prevent any text transformation
        fontVariant: 'normal' // Prevent font variants that can cause issues
      }}
    >
      {children}
    </span>
  );
};
