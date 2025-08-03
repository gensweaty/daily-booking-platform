
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ImageCarousel } from "./ImageCarousel";
import { Sparkles } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "@/components/shared/LanguageText";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { memo } from "react";
import { cn } from "@/lib/utils";

const productImages = [{
  src: "/lovable-uploads/89b6a836-d818-4753-a3f8-9d0d83dc7406.png",
  alt: "Pet Grooming Salon",
  loading: "lazy" as const,
  customStyle: "object-cover", 
  customPadding: "p-4"
}, {
  src: "/lovable-uploads/a00576d5-fb16-4a4b-a313-0e1cbb61b00c.png",
  alt: "Calendar Preview",
  loading: "lazy" as const
}, {
  src: "/lovable-uploads/7a8c5cac-2431-44db-8e9b-ca6e5ba6d633.png",
  alt: "Analytics Preview",
  loading: "lazy" as const
}, {
  src: "/lovable-uploads/292b8b91-64ee-4bf3-b4e6-1e68f77a6563.png",
  alt: "Tasks Preview",
  loading: "lazy" as const
}, {
  src: "/lovable-uploads/f35ff4e8-3ae5-4bc2-95f6-c3bef5d53689.png",
  alt: "CRM Preview",
  loading: "lazy" as const
}];

const MemoizedImageCarousel = memo(ImageCarousel);

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
      <div className="space-y-3 md:space-y-4 animate-fade-in">
        <article className="space-y-2 md:space-y-4">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold enhanced-gradient-text drop-shadow-lg">
            <LanguageText>{t('hero.title')}</LanguageText>
          </h1>
          <h2 className="text-xl md:text-2xl font-semibold text-foreground/90 drop-shadow-sm">
            <LanguageText>{t('hero.subtitle')}</LanguageText>
          </h2>
          <h3 className="text-base md:text-lg text-muted-foreground leading-relaxed">
            <LanguageText>{t('hero.description')}</LanguageText>
          </h3>
        </article>
        <div className="pt-2 md:pt-3 relative">
          <div className="absolute -inset-4 pointer-events-none hidden lg:block">
            <div className="absolute top-0 left-0 w-2 h-2 bg-primary/30 rounded-full animate-float will-animate" />
            <div className="absolute top-2 right-0 w-1 h-1 bg-accent/40 rounded-full animate-float-slow will-animate" />
            <div className="absolute bottom-0 left-1/2 w-1.5 h-1.5 bg-primary/20 rounded-full animate-float will-animate" style={{animationDelay: '1s'}} />
          </div>
          <Link to="/signup">
            <Button 
              size={isMobile ? "default" : "lg"} 
              variant="purple"
              className="group relative ripple-container will-animate gpu-layer"
            >
              <span className="flex items-center gap-2">
                {language === 'ka' ? "გამოსცადეთ უფასოდ" : t('nav.startJourney')}
                <Sparkles className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} animate-pulse`} aria-hidden="true" />
              </span>
            </Button>
          </Link>
        </div>
      </div>
      <div className="animate-fade-in transform-3d">
        <div className="hover-tilt transition-all duration-300">
          <MemoizedImageCarousel 
            images={productImages} 
            permanentArrows={true} 
            imageHeight="h-[480px]"
            objectFit="object-contain"
          />
        </div>
      </div>
    </main>
  );
});

HeroContent.displayName = 'HeroContent';
