
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "@/components/shared/LanguageText";
import { cn } from "@/lib/utils";
import { getGeorgianFontStyle } from "@/lib/font-utils";

export const CTASection = () => {
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';
  const georgianStyle = isGeorgian ? getGeorgianFontStyle() : undefined;
  
  return (
    <section className="py-20 bg-primary text-white">
      <div className="container mx-auto px-4 text-center">
        <h2 className={cn("text-3xl font-bold mb-6", isGeorgian ? "georgian-text-fix" : "")}>
          <LanguageText className="georgian-text-fix">{t('cta.title')}</LanguageText>
        </h2>
        <p className={cn("text-lg mb-8 opacity-90", isGeorgian ? "georgian-text-fix" : "")}>
          <LanguageText className="georgian-text-fix">{t('cta.subtitle')}</LanguageText>
        </p>
        <Link to="/signup">
          <Button 
            size="lg" 
            variant="secondary"
            className={cn(isGeorgian ? "georgian-text-fix" : "")}
            style={georgianStyle}
          >
            <LanguageText className="georgian-text-fix">{t('cta.button')}</LanguageText>
          </Button>
        </Link>
      </div>
    </section>
  );
};
