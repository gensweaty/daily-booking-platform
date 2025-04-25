
import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface LanguageTextProps {
  children: React.ReactNode;
  className?: string;
}

export const LanguageText = ({ children, className }: LanguageTextProps) => {
  const { language } = useLanguage();
  
  return (
    <span className={cn(
      language === 'ka' ? 'font-georgian' : 'font-sans',
      className
    )}>
      {children}
    </span>
  );
};
