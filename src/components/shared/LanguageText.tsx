
import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { getGeorgianFontStyle, getGeorgianButtonStyle } from '@/lib/font-utils';

interface LanguageTextProps {
  children: React.ReactNode;
  className?: string;
  withFont?: boolean;
  fixLetterSpacing?: boolean;
  isButton?: boolean;
}

export const LanguageText = ({ 
  children, 
  className,
  withFont = true,
  fixLetterSpacing = true,
  isButton = false
}: LanguageTextProps) => {
  const { language } = useLanguage();
  const isGeorgian = language === 'ka';
  
  if (!isGeorgian) {
    return <span className={className}>{children}</span>;
  }
  
  // For Georgian text, apply specific styling
  return (
    <span 
      className={cn(
        "ka-text", 
        isButton && "georgian-button-fix", 
        className
      )}
      style={isButton ? getGeorgianButtonStyle() : getGeorgianFontStyle()}
    >
      {children}
    </span>
  );
};
