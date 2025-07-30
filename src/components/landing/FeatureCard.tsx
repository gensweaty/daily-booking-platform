
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
      className={`grid md:grid-cols-2 gap-8 md:gap-12 items-center mb-16 md:mb-20 relative ${
        reverse ? 'md:flex-row-reverse' : ''
      }`}
    >
      {/* Background Pattern Overlay */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="w-full h-full" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='currentColor' fill-opacity='0.1'%3E%3Cpath d='m0 40l40-40h-40v40z'/%3E%3C/g%3E%3C/svg%3E")`,
          backgroundSize: '40px 40px'
        }} />
      </div>

      <div className={`space-y-4 md:space-y-6 ${reverse ? 'md:order-2' : ''} order-1 relative z-10`}>
        <div className="flex items-center gap-3 mb-3 md:mb-4">
          <motion.div 
            className="p-2 rounded-lg bg-primary/10 glass-morphism animate-pulse-glow"
            whileHover={{ scale: 1.1, rotate: 5 }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
          >
            <Icon className="w-5 h-5 md:w-6 md:h-6 text-primary animate-pulse" />
          </motion.div>
          <h3 className="text-xl md:text-2xl font-bold enhanced-gradient-text">
            <LanguageText>{t(getTranslationKey('title'))}</LanguageText>
          </h3>
        </div>
        <p className="text-base md:text-lg text-muted-foreground drop-shadow-sm">
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
              className="flex items-start gap-2 group"
            >
              <motion.div
                whileHover={{ scale: 1.2, rotate: 180 }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
              >
                <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-primary mt-1 drop-shadow-sm" />
              </motion.div>
              <span className="text-base sm:text-base md:text-base group-hover:text-primary transition-colors">
                <LanguageText>{t(getTranslationKey(`feature${idx + 1}`))}</LanguageText>
              </span>
            </motion.li>
          ))}
        </ul>
      </div>
      <motion.div
        initial={{ opacity: 0, x: reverse ? -50 : 50 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className={`relative ${reverse ? 'md:order-1' : ''} order-2 transform-3d`}
      >
        <div className="enhanced-card rounded-xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 bg-white/50 backdrop-blur-sm">
          {carousel ? (
            <div className="hover-tilt transition-all duration-300">
              <ImageCarousel 
                images={carousel} 
                className="mx-[-1rem]"
                permanentArrows={true}
                objectFit={getObjectFit()}
                imageHeight={getImageHeight()}
              />
            </div>
          ) : (
            <div className="hover-tilt transition-all duration-300">
              <img 
                src={image} 
                alt={t(getTranslationKey('title'))} 
                className={`w-full ${getImageHeight()} ${getObjectFit()} p-2 md:p-4 drop-shadow-lg`}
              />
            </div>
          )}
          {/* Subtle gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent pointer-events-none" />
        </div>
        
        {/* Floating decorative elements */}
        <div className="absolute -top-2 -right-2 w-4 h-4 bg-accent/30 rounded-full animate-float blur-sm" />
        <div className="absolute -bottom-2 -left-2 w-3 h-3 bg-primary/30 rounded-full animate-float-slow blur-sm" />
      </motion.div>
    </motion.div>
  );
};
