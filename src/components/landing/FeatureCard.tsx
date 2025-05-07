
import { LucideIcon } from "lucide-react";
import { CheckCircle } from "lucide-react";
import { ImageCarousel } from "./ImageCarousel";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { TranslationType } from "@/translations/types";
import { LanguageText } from "@/components/shared/LanguageText";
import { useMediaQuery } from "@/hooks/useMediaQuery";

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
  translationPrefix: 'booking' | 'analytics' | 'crm' | 'tasks' | 'website';
}

export const FeatureCard = ({
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
  
  // Determine appropriate object-fit based on feature type
  const getObjectFit = () => {
    if (translationPrefix === 'website') return 'object-cover';
    if (translationPrefix === 'booking') return 'object-contain';
    return 'object-contain';
  };
  
  // Determine responsive image height
  const getImageHeight = () => {
    if (isMobile) return 'h-[320px]';
    if (isTablet) return 'h-[400px]';
    return 'h-[480px]';
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className={`grid md:grid-cols-2 gap-8 md:gap-12 items-center mb-16 md:mb-20 ${
        reverse ? 'md:flex-row-reverse' : ''
      }`}
    >
      <div className={`space-y-4 md:space-y-6 ${reverse ? 'md:order-2' : ''} order-1`}>
        <div className="flex items-center gap-3 mb-3 md:mb-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="w-5 h-5 md:w-6 md:h-6 text-primary animate-pulse" />
          </div>
          <h3 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            <LanguageText>{t(getTranslationKey('title'))}</LanguageText>
          </h3>
        </div>
        <p className="text-base md:text-lg text-muted-foreground">
          <LanguageText>{t(getTranslationKey('description'))}</LanguageText>
        </p>
        <ul className="space-y-2 md:space-y-3">
          {benefits.map((benefit, idx) => (
            <motion.li
              key={idx}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="flex items-start gap-2"
            >
              <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-primary mt-1" />
              <span className="text-base sm:text-base md:text-base"><LanguageText>{t(getTranslationKey(`feature${idx + 1}`))}</LanguageText></span>
            </motion.li>
          ))}
        </ul>
      </div>
      <motion.div
        initial={{ opacity: 0, x: reverse ? -50 : 50 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className={`relative ${reverse ? 'md:order-1' : ''} order-2`}
      >
        <div className="rounded-xl overflow-hidden shadow-xl hover:shadow-2xl transition-shadow duration-300 bg-white">
          {carousel ? (
            <ImageCarousel 
              images={carousel} 
              className="mx-[-1rem]"
              permanentArrows={true}
              objectFit={getObjectFit()}
              imageHeight={getImageHeight()}
            />
          ) : (
            <img 
              src={image} 
              alt={t(getTranslationKey('title'))} 
              className={`w-full ${getImageHeight()} ${getObjectFit()} p-2 md:p-4`}
            />
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};
