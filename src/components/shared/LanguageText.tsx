
import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

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
  
  return (
    <span className={cn(
      withFont && isGeorgian ? 'font-georgian' : '',
      fixLetterSpacing && isGeorgian ? 'tracking-tight' : '',
      className
    )}>
      {children}
    </span>
  );
};
