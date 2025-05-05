
import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

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
      style={{
        fontFamily: "'BPG Glaho WEB Caps', 'DejaVu Sans', 'Arial Unicode MS', sans-serif",
        letterSpacing: fixLetterSpacing ? '-0.2px' : 'normal',
        fontWeight: 'normal',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        textRendering: 'optimizeLegibility'
      }}
    >
      {children}
    </span>
  );
};
