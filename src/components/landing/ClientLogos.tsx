
import { 
  PartyPopper, 
  Stethoscope, 
  Dumbbell, 
  Flower2, 
  Users, 
  GraduationCap 
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "@/components/shared/LanguageText";

export const ClientLogos = () => {
  const { t } = useLanguage();
  
  const logos = [
    { 
      name: t('business.events'),
      icon: PartyPopper,
      description: t('business.eventsDesc'),
      iconColor: "text-primary"
    },
    { 
      name: t('business.health'),
      icon: Stethoscope,
      description: t('business.healthDesc'),
      iconColor: "text-primary"
    },
    { 
      name: t('business.sports'),
      icon: Dumbbell,
      description: t('business.sportsDesc'),
      iconColor: "text-primary"
    },
    { 
      name: t('business.beauty'),
      icon: Flower2,
      description: t('business.beautyDesc'),
      iconColor: "text-primary"
    },
    { 
      name: t('business.personal'),
      icon: Users,
      description: t('business.personalDesc'),
      iconColor: "text-primary"
    },
    { 
      name: t('business.education'),
      icon: GraduationCap,
      description: t('business.educationDesc'),
      iconColor: "text-primary"
    },
  ];

  return (
    <div className="mb-16 border-y border-border py-8 sm:py-10">
      <h3 className="mb-7 text-xl font-semibold text-foreground sm:text-2xl">
        <LanguageText withFont={true}>{t('features.businessTitle')}</LanguageText>
      </h3>
      <div className="grid grid-cols-2 gap-x-5 gap-y-6 md:grid-cols-3 lg:grid-cols-6 lg:gap-x-6">
        {logos.map((company, index) => (
          <div
            key={index}
            className="min-w-0"
          >
            <div className="mb-2 flex min-h-10 items-center gap-2">
              <company.icon className={`h-5 w-5 shrink-0 ${company.iconColor}`} aria-hidden="true" />
              <span className="min-w-0 text-sm font-semibold leading-snug text-foreground">
                <LanguageText withFont={true}>{company.name}</LanguageText>
              </span>
            </div>
            <span className="block text-xs leading-relaxed text-muted-foreground sm:text-sm">
              <LanguageText withFont={true}>{company.description}</LanguageText>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
