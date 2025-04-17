
import { Button } from "@/components/ui/button";
import { Calendar, ListTodo, Users, BarChart, Globe } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export const FeatureButtons = () => {
  const { t } = useLanguage();

  const scrollToSection = (sectionId: string) => {
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="max-w-4xl mx-auto mb-16">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Button 
          variant="outline"
          onClick={() => scrollToSection('booking-website')}
          className="h-12 flex items-center justify-center gap-3 hover:bg-primary/10 hover:text-primary transition-all hover:scale-105 px-4"
        >
          <Globe className="w-5 h-5 text-accent shrink-0" />
          <span className="text-sm font-medium">{t('features.ownBookingWebsite')}</span>
        </Button>
        <Button 
          variant="outline"
          onClick={() => scrollToSection('smart-booking')}
          className="h-12 flex items-center justify-center gap-3 hover:bg-primary/10 hover:text-primary transition-all hover:scale-105 px-4"
        >
          <Calendar className="w-5 h-5 text-primary shrink-0" />
          <span className="text-sm font-medium">{t('features.booking')}</span>
        </Button>
        <Button 
          variant="outline"
          onClick={() => scrollToSection('analytics')}
          className="h-12 flex items-center justify-center gap-3 hover:bg-primary/10 hover:text-primary transition-all hover:scale-105 px-4"
        >
          <BarChart className="w-5 h-5 text-accent shrink-0" />
          <span className="text-sm font-medium">{t('features.analytics')}</span>
        </Button>
        <Button 
          variant="outline"
          onClick={() => scrollToSection('crm-solution')}
          className="h-12 flex items-center justify-center gap-3 hover:bg-primary/10 hover:text-primary transition-all hover:scale-105 px-4"
        >
          <Users className="w-5 h-5 text-primary shrink-0" />
          <span className="text-sm font-medium">{t('features.crm')}</span>
        </Button>
        <Button 
          variant="outline"
          onClick={() => scrollToSection('task-management')}
          className="h-12 flex items-center justify-center gap-3 hover:bg-primary/10 hover:text-primary transition-all hover:scale-105 px-4"
        >
          <ListTodo className="w-5 h-5 text-accent shrink-0" />
          <span className="text-sm font-medium">{t('features.tasks')}</span>
        </Button>
      </div>
    </div>
  );
};
