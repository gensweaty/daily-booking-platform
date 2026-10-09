
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ImageCarousel } from "./ImageCarousel";
import { ArrowRight, Check, CalendarCheck, MessageSquare } from "lucide-react";
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

const chips = {
  en: ["Booking confirmed", "SMS reminder sent"],
  es: ["Reserva confirmada", "Recordatorio SMS enviado"],
  ka: ["ჯავშანი დადასტურდა", "SMS შეხსენება გაიგზავნა"],
};

interface HeroContentProps {
  isMobileMenuOpen: boolean;
}

export const HeroContent = memo(({ isMobileMenuOpen }: HeroContentProps) => {
  const { t, language } = useLanguage();
  const isMobile = useMediaQuery("(max-width: 640px)");

  return (
    <main className={cn(
      "grid md:grid-cols-2 gap-6 md:gap-8 lg:gap-12 items-center mt-6 md:mt-8 lg:mt-12 relative",
      isMobileMenuOpen ? 'z-10' : 'z-20'
    )}>
      <div className="space-y-4 md:space-y-6 animate-fade-in">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs md:text-sm font-medium text-primary backdrop-blur-sm">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          <LanguageText>{eyebrow[language as keyof typeof eyebrow] || eyebrow.en}</LanguageText>
        </div>
        <article className="space-y-3 md:space-y-4">
          <h1 className="text-3xl md:text-4xl lg:text-[3.25rem] font-bold tracking-tight leading-[1.1] bg-gradient-to-br from-foreground via-foreground to-primary bg-clip-text text-transparent">
            <LanguageText>{t('hero.title')}</LanguageText>
          </h1>
          <h2 className="text-lg md:text-2xl font-semibold text-foreground/80">
            <LanguageText>{t('hero.subtitle')}</LanguageText>
          </h2>
          <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-xl">
            <LanguageText>{t('hero.description')}</LanguageText>
          </p>
        </article>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
          <Link to="/signup">
            <Button
              size={isMobile ? "default" : "lg"}
              className="group rounded-full px-6 shadow-lg shadow-primary/25 transition-all duration-300 hover:shadow-xl hover:shadow-primary/35 hover:-translate-y-0.5"
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
            className="rounded-full px-6 bg-background/60 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5"
            onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
          >
            {t('nav.pricing')}
          </Button>
        </div>
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
          {(trust[language as keyof typeof trust] || trust.en).map((item) => (
            <li key={item} className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-primary" aria-hidden="true" />
              <LanguageText>{item}</LanguageText>
            </li>
          ))}
        </ul>
      </div>
      <div className="relative animate-fade-in">
        <div className="pointer-events-none absolute -inset-6 md:-inset-10 rounded-[2rem] bg-primary/15 blur-3xl" aria-hidden="true" />
        <div className="relative rounded-2xl border border-border/60 bg-card/80 shadow-2xl shadow-primary/10 backdrop-blur-sm overflow-hidden transition-transform duration-500 ease-out hover:-translate-y-1">
          <div className="flex items-center gap-2 border-b border-border/60 bg-muted/40 px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
            <span className="h-2.5 w-2.5 rounded-full bg-primary/60" />
            <div className="ml-3 flex-1 truncate rounded-md bg-background/70 px-3 py-1 text-[11px] text-muted-foreground">
              smartbookly.com/dashboard
            </div>
          </div>
          <MemoizedImageCarousel
            images={productImages}
            permanentArrows={true}
            imageHeight={isMobile ? "h-[300px]" : "h-[440px]"}
            objectFit="object-contain"
            isHeroSlider={true}
          />
        </div>
        <div className="hidden lg:flex absolute -left-6 bottom-10 items-center gap-2 rounded-xl border border-border/60 bg-card/90 px-3 py-2 text-sm font-medium shadow-lg backdrop-blur-md">
          <CalendarCheck className="w-4 h-4 text-primary" aria-hidden="true" />
          <LanguageText>{(chips[language as keyof typeof chips] || chips.en)[0]}</LanguageText>
        </div>
        <div className="hidden lg:flex absolute -right-4 top-16 items-center gap-2 rounded-xl border border-border/60 bg-card/90 px-3 py-2 text-sm font-medium shadow-lg backdrop-blur-md">
          <MessageSquare className="w-4 h-4 text-primary" aria-hidden="true" />
          <LanguageText>{(chips[language as keyof typeof chips] || chips.en)[1]}</LanguageText>
        </div>
      </div>
    </main>
  );
});

HeroContent.displayName = 'HeroContent';
