
import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskList } from "@/components/TaskList";
import { NoteList } from "@/components/NoteList";
import { ReminderList } from "@/components/ReminderList";
import { Calendar } from "@/components/Calendar/Calendar";
import { CustomerList } from "@/components/crm/CustomerList";
import { Statistics } from "@/components/Statistics";
import { CalendarDays, CheckSquare, FileText, Bell, Users, BarChart3 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { ArchivedTasksPage } from "@/components/tasks/ArchivedTasksPage";
import { cn } from "@/lib/utils";

export const DashboardContent = () => {
  const [activeTab, setActiveTab] = useState("calendar");
  const { t } = useLanguage();
  const [isDeletionInProgress, setIsDeletionInProgress] = useState(false);

  // Monitor deletion events to prevent tab switching interference
  useEffect(() => {
    const handleEventDeletion = (event: CustomEvent) => {
      console.log('[DashboardContent] Event deletion detected, preventing tab interference');
      setIsDeletionInProgress(true);
      
      // Reset after a short delay to allow deletion to complete
      setTimeout(() => {
        setIsDeletionInProgress(false);
      }, 2000);
    };

    const handleCacheInvalidation = () => {
      console.log('[DashboardContent] Cache invalidation detected, preventing tab interference');
      setIsDeletionInProgress(true);
      
      setTimeout(() => {
        setIsDeletionInProgress(false);
      }, 1000);
    };

    window.addEventListener('calendar-event-deleted', handleEventDeletion as EventListener);
    window.addEventListener('calendar-cache-invalidated', handleCacheInvalidation);

    return () => {
      window.removeEventListener('calendar-event-deleted', handleEventDeletion as EventListener);
      window.removeEventListener('calendar-cache-invalidated', handleCacheInvalidation);
    };
  }, []);

  // Prevent tab changes during deletion to avoid query interference
  const handleTabChange = (value: string) => {
    if (isDeletionInProgress) {
      console.log('[DashboardContent] Tab change blocked due to deletion in progress');
      return;
    }
    
    console.log('[DashboardContent] Tab changed to:', value);
    setActiveTab(value);
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className={cn(
          "grid w-full grid-cols-6 mb-6",
          isDeletionInProgress && "pointer-events-none opacity-75"
        )}>
          <TabsTrigger value="calendar" className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            <span className="hidden sm:inline">{t("nav.calendar")}</span>
          </TabsTrigger>
          <TabsTrigger value="tasks" className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4" />
            <span className="hidden sm:inline">{t("nav.tasks")}</span>
          </TabsTrigger>
          <TabsTrigger value="notes" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">{t("nav.notes")}</span>
          </TabsTrigger>
          <TabsTrigger value="reminders" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">{t("nav.reminders")}</span>
          </TabsTrigger>
          <TabsTrigger value="crm" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">{t("nav.crm")}</span>
          </TabsTrigger>
          <TabsTrigger value="statistics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">{t("nav.statistics")}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="space-y-4">
          <Calendar />
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">{t("nav.tasks")}</h2>
          </div>
          <TaskList />
          <ArchivedTasksPage />
        </TabsContent>

        <TabsContent value="notes" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">{t("nav.notes")}</h2>
          </div>
          <NoteList />
        </TabsContent>

        <TabsContent value="reminders" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">{t("nav.reminders")}</h2>
          </div>
          <ReminderList />
        </TabsContent>

        <TabsContent value="crm" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">{t("nav.crm")}</h2>
          </div>
          <CustomerList />
        </TabsContent>

        <TabsContent value="statistics" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">{t("nav.statistics")}</h2>
          </div>
          <Statistics />
        </TabsContent>
      </Tabs>
    </div>
  );
};
