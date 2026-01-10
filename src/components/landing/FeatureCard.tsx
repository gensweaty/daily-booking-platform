import { LucideIcon, CheckCircle } from "lucide-react";
import { ImageCarousel } from "./ImageCarousel";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "@/components/shared/LanguageText";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { memo } from "react";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  benefits: string[];
  image?: string;
  carousel?: {
    src: string;
    alt: string;
    title?: string;
    customStyle?: string;
    customPadding?: string;
  }[];
  reverse?: boolean;
  translationPrefix: 'booking' | 'analytics' | 'crm' | 'tasks' | 'website' | 'teamChat' | 'aiAssistant';
}

export const FeatureCard = memo(({
  icon: Icon,
  title,
  description,
  benefits,
  image,
  carousel,
  reverse,
  translationPrefix,
}: FeatureCardProps) => {
  const { t } = useLanguage();
  const isMobile = useMediaQuery("(max-width: 640px)");
  const isTablet = useMediaQuery("(max-width: 1024px)");
  
  const getTranslationKey = (key: string): string => {
    return `${translationPrefix}.${key}`;
  };
  
  const getObjectFit = () => {
    if (translationPrefix === 'website') return 'object-cover';
    return 'object-contain';
  };
  
  const getImageHeight = () => {
    if (isMobile) return 'h-[320px]';
    if (isTablet) return 'h-[400px]';
    return 'h-[480px]';
  };
  
  return (
    <div
      className={`grid md:grid-cols-2 gap-6 md:gap-12 items-center mb-8 md:mb-20 relative animate-fade-in ${
        reverse ? 'md:flex-row-reverse' : ''
      }`}
    >
      <div className={`space-y-4 md:space-y-6 ${reverse ? 'md:order-2' : ''} order-1 relative z-10`}>
        <div className="flex items-center gap-3 mb-3 md:mb-4">
          <div className="p-2 rounded-lg bg-primary/10 glass-morphism">
            <Icon className="w-5 h-5 md:w-6 md:h-6 text-primary" />
          </div>
          <h3 className="text-xl md:text-2xl font-bold enhanced-gradient-text">
            <LanguageText>{t(getTranslationKey('title'))}</LanguageText>
          </h3>
        </div>
        <p className="text-base md:text-lg text-muted-foreground">
          <LanguageText>{t(getTranslationKey('description'))}</LanguageText>
        </p>
        <ul className="space-y-2 md:space-y-3">
          {benefits.map((benefit, idx) => (
            <li
              key={idx}
              className="flex items-start gap-2 group"
            >
              <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-primary mt-1 flex-shrink-0" />
              <span className="text-base group-hover:text-primary transition-colors">
                <LanguageText>{t(getTranslationKey(`feature${idx + 1}`))}</LanguageText>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className={`relative ${reverse ? 'md:order-1' : ''} order-2`}>
        <div className="rounded-xl overflow-hidden shadow-xl bg-white/50 dark:bg-black/20 backdrop-blur-sm transition-shadow duration-300 hover:shadow-2xl">
          {carousel ? (
            <ImageCarousel 
              images={carousel} 
              permanentArrows={true}
              objectFit={getObjectFit()}
              imageHeight={getImageHeight()}
              arrowsInside={true}
            />
          ) : (
            <img 
              src={image} 
              alt={t(getTranslationKey('title'))} 
              className={`w-full ${getImageHeight()} ${getObjectFit()} p-2 md:p-4`}
              loading="lazy"
            />
          )}
        </div>
      </div>
    </div>
  );
});

FeatureCard.displayName = 'FeatureCard';
