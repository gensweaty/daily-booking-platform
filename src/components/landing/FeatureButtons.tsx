
import { Button } from "@/components/ui/button";
import { Calendar, ListTodo, Users, BarChart, Globe, MessageCircle, Bot, Mail, Send, Code2, MessageSquare, ArrowDownRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "@/components/shared/LanguageText";

export const FeatureButtons = () => {
  const { t } = useLanguage();

  const scrollToSection = (sectionId: string) => {
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
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
      <nav aria-label={t('features.title')} className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {links.map(({ id, key, icon: Icon }) => (
          <Button key={id} variant="ghost" onClick={() => scrollToSection(id)}
            className="landing-surface group h-auto min-h-24 flex-wrap content-start items-start justify-start gap-2 rounded-lg border border-border p-3 text-left text-xs font-medium whitespace-normal transition-colors duration-200 hover:border-primary/40 hover:bg-primary/5 hover:text-primary sm:min-h-16 sm:flex-nowrap sm:items-center sm:gap-3 sm:p-4 sm:text-sm">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><Icon className="h-4 w-4" aria-hidden="true" /></span>
            <span className="order-3 w-full min-w-0 leading-relaxed sm:order-none sm:w-auto sm:flex-1"><LanguageText>{t(key)}</LanguageText></span>
            <ArrowDownRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-colors duration-200 group-hover:text-primary sm:ml-0" aria-hidden="true" />
          </Button>
        ))}
      </nav>
    </div>
  );
};
