import React from "react";
import { useLanguage } from "@/contexts/LanguageContext";

interface LanguageTextProps {
  textKey: string;
  className?: string;
  fallback?: string;
}

export const LanguageText: React.FC<LanguageTextProps> = ({ 
  textKey, 
  className = "",
  fallback = ""
}) => {
  const { t } = useLanguage();
  
  // If the translation key is missing, you can provide a fallback
  const translatedText = t(textKey) || fallback || textKey;
  
  return (
    <span className={className}>
      {t(textKey)}
    </span>
  );
};
