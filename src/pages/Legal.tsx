
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useTheme } from "next-themes";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useLanguage } from "@/contexts/LanguageContext";

const Legal = () => {
  const { theme } = useTheme();
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background">
      <header className="container mx-auto px-4 py-8">
        <nav className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => window.history.back()}
              className="hover:bg-accent"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Link to="/" className="flex items-center gap-2">
              <img 
                src={theme === 'dark' 
                  ? "/lovable-uploads/cfb84d8d-bdf9-4515-9179-f707416ece03.png"
                  : "/lovable-uploads/d1ee79b8-2af0-490e-969d-9101627c9e52.png"
                }
                alt="SmartBookly Logo" 
                className="h-8 md:h-10 w-auto"
              />
            </Link>
          </div>
          <ThemeToggle />
        </nav>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto prose dark:prose-invert">
          <h1 className="text-3xl font-bold mb-8">{t('legal.termsAndPrivacy')}</h1>
          <p className="text-muted-foreground">{t('legal.lastUpdated')}: 08.02.2025</p>

          <section className="mt-8">
            <h2 className="text-2xl font-semibold mb-4">{t('legal.termsTitle')}</h2>
            <p>{t('legal.termsIntro')}</p>

            <h3 className="text-xl font-semibold mt-6 mb-3">1. {t('legal.generalInfo')}</h3>
            <p>
              {t('legal.companyName')}: SmartBookly<br />
              {t('legal.companyRegistered')}: Georgia<br />
              {t('legal.contactEmail')}: info@smartbookly.com
            </p>

            <h3 className="text-xl font-semibold mt-6 mb-3">2. {t('legal.eligibility')}</h3>
            <p>{t('legal.eligibilityText')}</p>

            <h3 className="text-xl font-semibold mt-6 mb-3">3. {t('legal.accountTitle')}</h3>
            <ul>
              <li>{t('legal.accountInfo')}</li>
              <li>{t('legal.accountSecurity')}</li>
              <li>{t('legal.accountNotify')}</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">4. {t('legal.acceptableUseTitle')}</h3>
            <ul>
              <li>{t('legal.acceptableUse1')}</li>
              <li>{t('legal.acceptableUse2')}</li>
              <li>{t('legal.acceptableUse3')}</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">5. {t('legal.paymentsTitle')}</h3>
            <ul>
              <li>{t('legal.payments1')}</li>
              <li>{t('legal.payments2')}</li>
              <li>{t('legal.payments3')}</li>
            </ul>
          </section>

          <section className="mt-12">
            <h2 className="text-2xl font-semibold mb-4">{t('legal.privacyTitle')}</h2>
            <p>{t('legal.privacyIntro')}</p>

            <h3 className="text-xl font-semibold mt-6 mb-3">1. {t('legal.infoCollectTitle')}</h3>
            <p>{t('legal.infoCollectIntro')}:</p>
            <ul>
              <li>{t('legal.infoCollect1')}</li>
              <li>{t('legal.infoCollect2')}</li>
              <li>{t('legal.infoCollect3')}</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">2. {t('legal.dataUseTitle')}</h3>
            <p>{t('legal.dataUseIntro')}:</p>
            <ul>
              <li>{t('legal.dataUse1')}</li>
              <li>{t('legal.dataUse2')}</li>
              <li>{t('legal.dataUse3')}</li>
              <li>{t('legal.dataUse4')}</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">3. {t('legal.dataRightsTitle')}</h3>
            <p>{t('legal.dataRightsIntro')}:</p>
            <ul>
              <li>{t('legal.dataRights1')}</li>
              <li>{t('legal.dataRights2')}</li>
              <li>{t('legal.dataRights3')}</li>
              <li>{t('legal.dataRights4')}</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">{t('legal.contactUs')}</h3>
            <p>{t('legal.contactUsText')}</p>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Legal;
