
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ImageCarousel } from "./ImageCarousel";
import { ArrowRight, Check, LockKeyhole, CalendarCheck } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "@/components/shared/LanguageText";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { memo } from "react";
import { cn } from "@/lib/utils";

const productImages = [{
  src: "/lovable-uploads/hero-tasks-view.webp",
  srcDark: "/lovable-uploads/hero-tasks-view-dark.webp",
  alt: "Smartbookly Tasks Management Dashboard - Organize and track tasks efficiently",
  loading: "eager" as const,
  customStyle: "object-contain",
  customPadding: "p-4"
}, {
  src: "/lovable-uploads/hero-statistics-view.webp",
  srcDark: "/lovable-uploads/hero-statistics-view-dark.webp",
  alt: "Smartbookly Statistics Dashboard - Business analytics and insights",
  loading: "lazy" as const,
  customStyle: "object-contain",
  customPadding: "p-4"
}, {
  src: "/lovable-uploads/hero-calendar-month.webp",
  srcDark: "/lovable-uploads/hero-calendar-month-dark.webp",
  alt: "Smartbookly Calendar Month View - Schedule and manage appointments",
  loading: "lazy" as const,
  customStyle: "object-contain",
  customPadding: "p-4"
}, {
  src: "/lovable-uploads/hero-calendar-week.webp",
  srcDark: "/lovable-uploads/hero-calendar-week-dark.webp",
  alt: "Smartbookly Calendar Week View - Weekly schedule overview",
  loading: "lazy" as const,
  customStyle: "object-contain",
  customPadding: "p-4"
}, {
  src: "/lovable-uploads/hero-calendar-day.webp",
  srcDark: "/lovable-uploads/hero-calendar-day-dark.webp",
  alt: "Smartbookly Calendar Day View - Daily appointment management",
  loading: "lazy" as const,
  customStyle: "object-contain",
  customPadding: "p-4"
}, {
  src: "/lovable-uploads/hero-business-page.webp",
  srcDark: "/lovable-uploads/hero-business-page-dark.webp",
  alt: "Smartbookly Business Page - Professional online presence",
  loading: "lazy" as const,
  customStyle: "object-cover",
  customPadding: "p-4"
}, {
  src: "/lovable-uploads/hero-crm-view.webp",
  srcDark: "/lovable-uploads/hero-crm-view-dark.webp",
  alt: "Smartbookly CRM Dashboard - Customer relationship management",
  loading: "lazy" as const,
  customStyle: "object-contain",
  customPadding: "p-4"
}];

const MemoizedImageCarousel = memo(ImageCarousel);

const eyebrow = {
  en: "AI-powered booking & business workspace",
  es: "Reservas y gestión empresarial con IA",
  ka: "AI-ით მართული ჯავშნები და ბიზნეს სივრცე",
};

const trust = {
  en: ["No credit card required", "Setup in minutes", "Free business website"],
  es: ["Sin tarjeta de crédito", "Configuración en minutos", "Sitio web gratuito"],
  ka: ["საკრედიტო ბარათი არ არის საჭირო", "წუთებში გამართვა", "უფასო ბიზნეს საიტი"],
};

interface HeroContentProps {
  isMobileMenuOpen: boolean;
}

export const HeroContent = memo(({ isMobileMenuOpen }: HeroContentProps) => {
  const { t, language } = useLanguage();
  const isMobile = useMediaQuery("(max-width: 640px)");

  return (
    <main className={cn(
      "flex flex-col items-center gap-6 sm:gap-8 mt-7 md:mt-12 mb-8 lg:mb-12 relative",
      isMobileMenuOpen ? 'z-10' : 'z-20'
    )}>
      <div className="w-full max-w-4xl space-y-4 text-center md:space-y-5">
        <div className="landing-surface inline-flex max-w-full items-center gap-2 rounded-full border border-primary/20 px-3 py-2 text-[11px] font-mono font-medium text-primary sm:text-sm">
          <CalendarCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <LanguageText>{eyebrow[language as keyof typeof eyebrow] || eyebrow.en}</LanguageText>
        </div>
        <article className="space-y-3 md:space-y-4">
          <h1 className="landing-display text-5xl font-bold leading-[1.05] sm:text-6xl lg:text-7xl">SmartBookly</h1>
          <h2 className="text-xl font-semibold leading-tight text-foreground sm:text-3xl lg:text-4xl">
            <LanguageText>{t('hero.title')}</LanguageText>
          </h2>
          <p className="text-sm font-medium leading-relaxed text-muted-foreground sm:text-base">
            <LanguageText>{t('hero.subtitle')}</LanguageText>
          </p>
        </article>
        <div className="flex items-center justify-center gap-3 pt-1">
          <Link to="/signup" className="min-w-0">
            <Button
              size={isMobile ? "default" : "lg"}
              className="landing-elevated group max-w-full rounded-md px-4 text-sm transition-colors duration-200 sm:px-6"
            >
              <span className="flex items-center gap-2">
                {language === 'ka' ? "გამოსცადეთ უფასოდ" : t('nav.startJourney')}
                <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
              </span>
            </Button>
          </Link>
          <Button
            variant="outline"
            size={isMobile ? "default" : "lg"}
            className="rounded-md px-4 bg-card transition-colors duration-200 sm:px-6"
            onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
          >
            {t('nav.pricing')}
          </Button>
        </div>
        <ul className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-[11px] text-muted-foreground sm:text-sm">
          {(trust[language as keyof typeof trust] || trust.en).map((item) => (
            <li key={item} className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-primary" aria-hidden="true" />
              <LanguageText>{item}</LanguageText>
            </li>
          ))}
        </ul>
      </div>
      <div className="landing-stage relative w-full min-w-0 max-w-4xl rounded-lg border border-border p-2 sm:p-3 lg:p-4">
        
        <div className="landing-elevated relative rounded-lg border border-border bg-card overflow-hidden">
          <div className="flex h-11 items-center gap-1.5 border-b border-border bg-muted/40 px-3 sm:px-4">
            <span className="h-2 w-2 shrink-0 rounded-full bg-accent/70" aria-hidden="true" />
            <span className="h-2 w-2 shrink-0 rounded-full bg-muted-foreground/40" aria-hidden="true" />
            <span className="h-2 w-2 shrink-0 rounded-full bg-secondary/70" aria-hidden="true" />
            <div className="ml-2 flex min-w-0 flex-1 items-center justify-center gap-1.5 font-mono text-[11px] text-muted-foreground sm:ml-3">
              <LockKeyhole className="h-3 w-3 shrink-0" aria-hidden="true" /><span className="truncate">smartbookly.com/dashboard</span>
            </div>
          </div>
          <MemoizedImageCarousel
            images={productImages}
            permanentArrows={true}
            imageHeight={isMobile ? "h-[300px]" : "h-[440px]"}
            objectFit="object-contain"
            arrowsInside={true}
            isHeroSlider={true}
          />
        </div>
      </div>
      <p className="max-w-3xl text-center text-sm leading-relaxed text-muted-foreground sm:text-base">
        <LanguageText>{t('hero.description')}</LanguageText>
      </p>
    </main>
  );
});

HeroContent.displayName = 'HeroContent';
