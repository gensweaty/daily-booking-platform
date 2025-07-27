
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "@/components/shared/LanguageText";

export const CTASection = () => {
  const { t } = useLanguage();
  
  return (
    <section className="py-20 bg-primary/90 dark:bg-primary/80 text-white">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-3xl font-bold mb-6"><LanguageText>{t('cta.title')}</LanguageText></h2>
        <p className="text-lg mb-8 opacity-90">
          <LanguageText>{t('cta.subtitle')}</LanguageText>
        </p>
        <Link to="/signup">
          <Button size="lg" variant="secondary">
            <LanguageText>{t('cta.button')}</LanguageText>
          </Button>
        </Link>
      </div>
    </section>
  );
};
