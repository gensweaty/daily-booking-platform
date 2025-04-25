
import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface LanguageTextProps {
  children: React.ReactNode;
  className?: string;
  withFont?: boolean;
}

export const LanguageText = ({ 
  children, 
  className,
  withFont = true
}: LanguageTextProps) => {
  const { language } = useLanguage();
  const isGeorgian = language === 'ka';
  
  return (
    <span className={cn(
      withFont && isGeorgian ? 'font-georgian' : '',
      className
    )}>
      {children}
    </span>
  );
};
