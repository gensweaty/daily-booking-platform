
import React from "react";
import { useLanguage } from "@/contexts/LanguageContext";

interface LanguageTextProps {
  textKey?: string;
  children?: string | number;
  className?: string;
  fallback?: string;
  withFont?: boolean;
  translateParams?: Record<string, string | number>;
}

export const LanguageText: React.FC<LanguageTextProps> = ({ 
  textKey, 
  children,
  className = "",
  fallback = "",
  withFont = false,
  translateParams
}) => {
  const { t } = useLanguage();
  
  // If textKey is provided, use it for translation
  if (textKey) {
    const translatedText = t(textKey, translateParams) || fallback || textKey;
    return (
      <span className={className}>
        {translatedText}
      </span>
    );
  }
  
  // If children is provided, use it directly (assuming it's already translated)
  if (children !== undefined) {
    return (
      <span className={className}>
        {children}
      </span>
    );
  }
  
  // Fallback case
  return (
    <span className={className}>
      {fallback}
    </span>
  );
};
