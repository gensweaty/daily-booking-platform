
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
  
  // Handle translation keys directly if passed as string
  if (typeof children === 'string' && children.includes('.')) {
    try {
      const { t } = useLanguage();
      const possibleTranslation = t(children);
      // If the returned value is different from the key, it's a valid translation
      if (possibleTranslation !== children) {
        children = possibleTranslation;
      }
    } catch (error) {
      // Silently fail if it's not a valid translation key
    }
  }
  
  if (!isGeorgian) {
    return <span className={className}>{children}</span>;
  }
  
  // For Georgian text, apply specific styling
  return (
    <span 
      className={cn("ka-text georgian-text-fix", className)}
      style={withFont ? getGeorgianFontStyle() : undefined}
    >
      {children}
    </span>
  );
};
