
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

export const CTASection = () => {
  const { t } = useLanguage();
  
  return (
    <section className="py-20 bg-primary text-white">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-3xl font-bold mb-6">{t('cta.title')}</h2>
        <p className="text-lg mb-8 opacity-90">
          {t('cta.subtitle')}
        </p>
        <Link to="/signup">
          <Button size="lg" variant="secondary">
            {t('cta.button')}
          </Button>
        </Link>
      </div>
    </section>
  );
};
