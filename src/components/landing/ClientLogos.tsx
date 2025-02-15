
import { motion } from "framer-motion";
import { 
  PartyPopper, 
  Stethoscope, 
  Dumbbell, 
  Flower2, 
  Users, 
  GraduationCap 
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export const ClientLogos = () => {
  const { t } = useLanguage();
  
  const logos = [
    { 
      name: t('business.events'),
      icon: PartyPopper,
      description: t('business.eventsDesc'),
      bgColor: "bg-purple-100",
      iconColor: "text-purple-500"
    },
    { 
      name: t('business.health'),
      icon: Stethoscope,
      description: t('business.healthDesc'),
      bgColor: "bg-blue-100",
      iconColor: "text-blue-500"
    },
    { 
      name: t('business.sports'),
      icon: Dumbbell,
      description: t('business.sportsDesc'),
      bgColor: "bg-green-100",
      iconColor: "text-green-500"
    },
    { 
      name: t('business.beauty'),
      icon: Flower2,
      description: t('business.beautyDesc'),
      bgColor: "bg-pink-100",
      iconColor: "text-pink-500"
    },
    { 
      name: t('business.personal'),
      icon: Users,
      description: t('business.personalDesc'),
      bgColor: "bg-orange-100",
      iconColor: "text-orange-500"
    },
    { 
      name: t('business.education'),
      icon: GraduationCap,
      description: t('business.educationDesc'),
      bgColor: "bg-teal-100",
      iconColor: "text-teal-500"
    },
  ];

  return (
    <div className="w-full bg-muted/30 py-8">
      <div className="container mx-auto px-4">
        <h3 className="text-center text-2xl font-semibold mb-8 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          {t('features.businessTitle')}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
          {logos.map((company, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex flex-col items-center space-y-3 p-4 rounded-lg hover:bg-background/50 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:-translate-y-1 group"
            >
              <div className={`p-4 rounded-full ${company.bgColor} group-hover:scale-110 transition-transform duration-300`}>
                <company.icon className={`w-8 h-8 ${company.iconColor}`} />
              </div>
              <span className="text-base font-medium text-center leading-tight">{company.name}</span>
              <span className="text-sm text-muted-foreground text-center hidden lg:block leading-snug">
                {company.description}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};
