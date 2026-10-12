
import { Button } from "@/components/ui/button";
import { Calendar, ListTodo, Users, BarChart, Globe, MessageCircle, Bot, Mail, Send, Code2, MessageSquare } from "lucide-react";
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

  const links = [
    { id: "ai-assistant", key: "aiAssistant.title", icon: Bot },
    { id: "booking-website", key: "features.ownBookingWebsite", icon: Globe },
    { id: "smart-booking", key: "features.smartAppointment", icon: Calendar },
    { id: "analytics", key: "features.automatedAnalytics", icon: BarChart },
    { id: "crm-solution", key: "features.modernCRM", icon: Users },
    { id: "task-management", key: "features.kanbanManagement", icon: ListTodo },
    { id: "team-chat", key: "features.teamChat", icon: MessageCircle },
    { id: "telegram-ai", key: "features.telegramAi", icon: Send },
    { id: "embed-booking", key: "features.embedBooking", icon: Code2 },
    { id: "email-campaigns", key: "features.emailCampaigns", icon: Mail },
    { id: "sms-notifications", key: "features.smsNotifications", icon: MessageSquare },
  ];
  return (
    <div className="mb-12 sm:mb-16">
      <h2 className="mb-6 text-2xl font-semibold text-foreground sm:text-3xl">
        <LanguageText>{t('features.title')}</LanguageText>
      </h2>
      <nav aria-label={t('features.title')} className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
        {links.map(({ id, key, icon: Icon }) => (
          <Button key={id} variant="ghost" onClick={() => scrollToSection(id)}
            className="h-auto min-h-12 justify-start gap-3 rounded-none border-b border-border px-0 py-3 text-left text-sm font-medium whitespace-normal hover:bg-primary/5 hover:text-primary">
            <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <LanguageText>{t(key)}</LanguageText>
          </Button>
        ))}
      </nav>
    </div>
  );
};
