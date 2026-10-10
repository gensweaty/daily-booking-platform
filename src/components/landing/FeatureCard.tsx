import { LucideIcon, CheckCircle } from "lucide-react";
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
  wide?: boolean;
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
  wide = false,
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
      className="group/feature flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground transition-colors duration-200 hover:border-primary/40"
    >
      <div className="min-w-0 space-y-4 p-5 sm:p-7">
        <div className="flex items-start gap-3">
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", wide ? "bg-primary/10 text-primary" : "bg-secondary/10 text-secondary")}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <h3 className="min-w-0 pt-1 text-xl font-semibold leading-snug text-foreground sm:text-2xl">
            <LanguageText>{t(getTranslationKey('title'))}</LanguageText>
          </h3>
        </div>
        <p className="font-mono text-sm leading-relaxed text-muted-foreground">
          <LanguageText>{t(getTranslationKey('description'))}</LanguageText>
        </p>
        <ul className={cn("grid gap-x-5 gap-y-2.5", wide && "sm:grid-cols-2")}>
          {benefits.map((benefit, idx) => (
            <li
              key={idx}
              className="flex min-w-0 items-start gap-2"
            >
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-secondary" aria-hidden="true" />
              <span className="min-w-0 font-mono text-sm leading-relaxed">
                <LanguageText>{t(getTranslationKey(`feature${idx + 1}`))}</LanguageText>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-auto border-t border-border bg-muted/40 p-3 sm:p-4">
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
    </article>
  );
};

export const FeatureCard = memo(FeatureCardComponent);
FeatureCard.displayName = 'FeatureCard';

export default FeatureCard;
