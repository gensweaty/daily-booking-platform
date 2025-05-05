
import { Button } from "@/components/ui/button";
import { Calendar, ListTodo, Users, BarChart, Globe } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "@/components/shared/LanguageText";

export const FeatureButtons = () => {
  const { t } = useLanguage();

  const scrollToSection = (sectionId: string) => {
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="mb-16">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-semibold text-[#E17B9E]">
          <LanguageText>{t('features.title')}</LanguageText>
        </h2>
      </div>
      <div className="max-w-4xl mx-auto">
        {/* First row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Button 
            variant="outline"
            onClick={() => scrollToSection('booking-website')}
            className="h-12 flex items-center justify-center gap-3 hover:bg-primary/10 hover:text-primary transition-all hover:scale-105 px-4"
          >
            <Globe className="w-5 h-5 text-accent shrink-0" />
            <span className="text-sm font-medium">
              <LanguageText>{t('features.ownBookingWebsite')}</LanguageText>
            </span>
          </Button>
          <Button 
            variant="outline"
            onClick={() => scrollToSection('smart-booking')}
            className="h-12 flex items-center justify-center gap-3 hover:bg-primary/10 hover:text-primary transition-all hover:scale-105 px-4"
          >
            <Calendar className="w-5 h-5 text-primary shrink-0" />
            <span className="text-sm font-medium">
              <LanguageText>{t('features.smartAppointment')}</LanguageText>
            </span>
          </Button>
          <Button 
            variant="outline"
            onClick={() => scrollToSection('analytics')}
            className="h-12 flex items-center justify-center gap-3 hover:bg-primary/10 hover:text-primary transition-all hover:scale-105 px-4"
          >
            <BarChart className="w-5 h-5 text-accent shrink-0" />
            <span className="text-sm font-medium">
              <LanguageText>{t('features.automatedAnalytics')}</LanguageText>
            </span>
          </Button>
        </div>
        {/* Second row - centered */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 md:w-2/3 mx-auto">
          <Button 
            variant="outline"
            onClick={() => scrollToSection('crm-solution')}
            className="h-12 flex items-center justify-center gap-3 hover:bg-primary/10 hover:text-primary transition-all hover:scale-105 px-4"
          >
            <Users className="w-5 h-5 text-primary shrink-0" />
            <span className="text-sm font-medium">
              <LanguageText>{t('features.modernCRM')}</LanguageText>
            </span>
          </Button>
          <Button 
            variant="outline"
            onClick={() => scrollToSection('task-management')}
            className="h-12 flex items-center justify-center gap-3 hover:bg-primary/10 hover:text-primary transition-all hover:scale-105 px-4"
          >
            <ListTodo className="w-5 h-5 text-accent shrink-0" />
            <span className="text-sm font-medium">
              <LanguageText>{t('features.kanbanManagement')}</LanguageText>
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
};
