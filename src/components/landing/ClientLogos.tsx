
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
    <div className="mb-16 border-y border-border py-10 sm:py-12">
      <h3 className="text-center text-2xl font-semibold mb-8 text-foreground">
        <LanguageText withFont={true}>{t('features.businessTitle')}</LanguageText>
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-8">
        {logos.map((company, index) => (
          <div
            key={index}
            className="flex flex-col items-center space-y-3"
          >
            <div className={"flex h-10 w-10 items-center justify-center"}>
              <company.icon className={`w-7 h-7 ${company.iconColor}`} />
            </div>
            <span className="text-base font-medium text-center leading-tight">
              <LanguageText withFont={true}>{company.name}</LanguageText>
            </span>
            <span className="text-sm text-muted-foreground text-center  leading-snug">
              <LanguageText withFont={true}>{company.description}</LanguageText>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
