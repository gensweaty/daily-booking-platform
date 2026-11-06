import { LucideIcon, Check } from "lucide-react";
import { ImageCarousel } from "./ImageCarousel";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "@/components/shared/LanguageText";
import { memo } from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  benefits: string[];
  image?: string;
  imageDark?: string;
  carousel?: {
    src: string;
    srcDark?: string;
    alt: string;
    title?: string;
    customStyle?: string;
    customPadding?: string;
  }[];

  reverse?: boolean;
  translationPrefix: 'booking' | 'analytics' | 'crm' | 'tasks' | 'website' | 'teamChat' | 'aiAssistant' | 'emailCampaigns' | 'telegramAi' | 'embedBooking' | 'smsNotifications';
}

const FeatureCardComponent = ({
  icon: Icon,
  title,
  description,
  benefits,
  image,
  imageDark,
  carousel,
  reverse = false,
  translationPrefix,
}: FeatureCardProps) => {
  const { t } = useLanguage();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  // Use the opposite screenshot theme for deliberate contrast:
  // light dashboard captures on the dark site, dark captures on the light site.
  const displayImage = imageDark
    ? (isDark ? image : imageDark)
    : image;
  
  const getTranslationKey = (key: string): string => {
    return `${translationPrefix}.${key}`;
  };
  
  return (
    <article
      className="group/feature grid min-w-0 items-center gap-8 lg:grid-cols-2 lg:gap-12"
    >
      <div className={cn("min-w-0 space-y-5", reverse && "lg:order-2")}>
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
            <Icon className="h-6 w-6" aria-hidden="true" />
          </div>
          <h3 className="landing-feature-heading min-w-0 pt-1 text-2xl font-bold leading-snug sm:text-3xl">
            <LanguageText>{t(getTranslationKey('title'))}</LanguageText>
          </h3>
        </div>
        <p className="font-mono text-base leading-relaxed text-muted-foreground">
          <LanguageText>{t(getTranslationKey('description'))}</LanguageText>
        </p>
        <ul className="grid gap-3">
          {benefits.map((benefit, idx) => (
            <li
              key={idx}
              className="flex min-w-0 items-start gap-3"
            >
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary/10"><Check className="h-3.5 w-3.5 landing-green" aria-hidden="true" /></span>
              <span className="min-w-0 font-mono text-sm leading-relaxed text-foreground sm:text-base">
                <LanguageText>{t(getTranslationKey(`feature${idx + 1}`))}</LanguageText>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div data-tone={['telegramAi', 'teamChat', 'crm'].includes(translationPrefix) ? 'green' : ['smsNotifications', 'emailCampaigns', 'embedBooking'].includes(translationPrefix) ? 'coral' : 'blue'} className={cn("landing-feature-stage order-first min-w-0 lg:order-none", reverse && "lg:order-1")}>
        <div className="mb-3 flex min-w-0 items-center gap-2 text-xs font-medium text-muted-foreground">
          <Icon className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
          <span className="min-w-0 truncate"><LanguageText>{t(getTranslationKey('title'))}</LanguageText></span>
        </div>
        <div className="landing-elevated overflow-hidden rounded-lg border border-border bg-card p-1 transition-colors duration-200 hover:border-primary/40">
          {carousel ? (
            <ImageCarousel 
              images={carousel} 
              permanentArrows={true}
              objectFit="object-contain"
              arrowsInside={true}
              isFeatureGrid={true}
            />
          ) : (
            <img 
              src={displayImage} 
              alt={t(getTranslationKey('title'))} 
              className="aspect-[16/10] w-full rounded-md object-contain"
              loading="lazy"
              decoding="async"
            />
          )}
        </div>
      </div>
    </article>
  );
};

export const FeatureCard = memo(FeatureCardComponent);
FeatureCard.displayName = 'FeatureCard';

export default FeatureCard;
