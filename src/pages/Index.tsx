
import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardHeader } from '@/components/DashboardHeader';
import { DashboardContent } from '@/components/dashboard/DashboardContent';
import { Statistics } from '@/components/Statistics';
import { TaskList } from '@/components/TaskList';
import { NoteList } from '@/components/NoteList';
import { ReminderList } from '@/components/ReminderList';
import { CalendarView } from '@/components/Calendar/CalendarView';
import { TrialExpiredDialog } from '@/components/TrialExpiredDialog';
import { CustomerList } from '@/components/crm/CustomerList';
import { BusinessPage } from '@/components/business/BusinessPage';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLanguage } from '@/contexts/LanguageContext';
import { GeorgianAuthText } from '@/components/shared/GeorgianAuthText';
import { LanguageText } from '@/components/shared/LanguageText';
import { useSubscriptionRedirect } from '@/hooks/useSubscriptionRedirect';
import { useCalendarEvents } from '@/hooks/useCalendarEvents';
import { startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';

const Index = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';
  const [activeTab, setActiveTab] = useState('overview');
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState<'month' | 'week' | 'day'>('month');

  // Use the subscription redirect hook
  useSubscriptionRedirect();

  // Get calendar events
  const { data: events = [] } = useCalendarEvents();

  // Generate days for the calendar view
  const getDaysForView = () => {
    if (view === 'month') {
      const monthStart = startOfMonth(selectedDate);
      const monthEnd = endOfMonth(selectedDate);
      return eachDayOfInterval({ start: monthStart, end: monthEnd });
    }
    // For week and day views, we can return a simpler array
    return [selectedDate];
  };

  const days = getDaysForView();

  // Scroll to top when tab changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab]);

  if (!user) {
    return null;
  }

  const renderTabTrigger = (value: string, labelKey: string) => (
    <TabsTrigger value={value} className={isGeorgian ? "font-georgian" : ""}>
      {isGeorgian ? (
        <GeorgianAuthText>{t(labelKey)}</GeorgianAuthText>
      ) : (
        <LanguageText>{t(labelKey)}</LanguageText>
      )}
    </TabsTrigger>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader />
      <TrialExpiredDialog />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="mb-8">
            <TabsList className="grid grid-cols-3 sm:grid-cols-6 w-full lg:w-auto gap-1">
              {renderTabTrigger('overview', 'dashboard.overview')}
              {renderTabTrigger('calendar', 'dashboard.calendar')}
              {renderTabTrigger('tasks', 'dashboard.tasks')}
              {renderTabTrigger('crm', 'dashboard.crm')}
              {renderTabTrigger('stats', 'dashboard.stats')}
              {renderTabTrigger('business', 'dashboard.business')}
            </TabsList>
          </div>

          <TabsContent value="overview">
            <DashboardContent 
              isTaskDialogOpen={isTaskDialogOpen}
              setIsTaskDialogOpen={setIsTaskDialogOpen}
            />
          </TabsContent>

          <TabsContent value="calendar">
            <CalendarView 
              days={days}
              events={events}
              selectedDate={selectedDate}
              view={view}
            />
          </TabsContent>

          <TabsContent value="tasks">
            <div className="space-y-6">
              <TaskList />
            </div>
          </TabsContent>

          <TabsContent value="crm">
            <CustomerList />
          </TabsContent>

          <TabsContent value="stats">
            <Statistics />
          </TabsContent>

          <TabsContent value="business">
            <BusinessPage />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
