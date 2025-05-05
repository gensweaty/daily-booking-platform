
import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { getGeorgianFontStyle } from '@/lib/font-utils';

interface LanguageTextProps {
  children: React.ReactNode;
  className?: string;
  withFont?: boolean;
  fixLetterSpacing?: boolean;
}

export const LanguageText = ({ 
  children, 
  className,
  withFont = true,
  fixLetterSpacing = true
}: LanguageTextProps) => {
  const { language } = useLanguage();
  const isGeorgian = language === 'ka';
  
  if (!isGeorgian) {
    return <span className={className}>{children}</span>;
  }
  
  // For Georgian text, apply comprehensive styling to fix all letter issues
  return (
    <span 
      className={cn("ka-text georgian-text-fix", className)}
      style={{
        ...getGeorgianFontStyle(),
        letterSpacing: fixLetterSpacing ? '-0.2px' : 'normal',
        fontFeatureSettings: '"case" 0',
        textTransform: 'none',
        fontVariant: 'normal'
      }}
    >
      {children}
    </span>
  );
};
