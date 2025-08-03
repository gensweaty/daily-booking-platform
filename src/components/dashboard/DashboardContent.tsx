
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { Statistics } from '@/components/Statistics';
import { NoteList } from '@/components/NoteList';
import { TaskList } from '@/components/TaskList';
import { Calendar } from '@/components/Calendar/Calendar';
import { CustomerList } from '@/components/crm/CustomerList';
import { BookingRequestsList } from '@/components/business/BookingRequestsList';
import { BusinessPage } from '@/components/business/BusinessPage';
import { ArchivedTasksPage } from '@/components/tasks/ArchivedTasksPage';
import { ReminderNotifications } from '@/components/reminder/ReminderNotifications';
import { TaskReminderNotifications } from '@/components/tasks/TaskReminderNotifications';
import { EventReminderNotifications } from '@/components/Calendar/EventReminderNotifications';
import { LanguageText } from '@/components/shared/LanguageText';
import { GeorgianAuthText } from '@/components/shared/GeorgianAuthText';

interface DashboardContentProps {
  activeSection: string;
  setActiveSection: (section: string) => void;
}

export const DashboardContent: React.FC<DashboardContentProps> = ({
  activeSection,
  setActiveSection
}) => {
  const { language, t } = useLanguage();
  const isGeorgian = language === 'ka';
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);

  const handleTaskDialogClose = () => {
    setTaskDialogOpen(false);
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'statistics':
        return <Statistics />;
      case 'notes':
        return <NoteList />;
      case 'tasks':
        return <TaskList />;
      case 'calendar':
        return <Calendar />;
      case 'crm':
        return <CustomerList />;
      case 'booking-requests':
        return <BookingRequestsList />;
      case 'business':
        return <BusinessPage />;
      case 'archived-tasks':
        return <ArchivedTasksPage />;
      default:
        return (
          <div className="flex items-center justify-center h-64">
            <p className="text-lg text-gray-500">
              {isGeorgian ? (
                <GeorgianAuthText>აირჩიეთ სექცია მენიუდან</GeorgianAuthText>
              ) : (
                <LanguageText>{t('dashboard.selectSection')}</LanguageText>
              )}
            </p>
          </div>
        );
    }
  };

  return (
    <div className="flex-1 p-6">
      {/* Notification components that run in background */}
      <ReminderNotifications />
      <TaskReminderNotifications />
      <EventReminderNotifications />
      
      {renderContent()}
    </div>
  );
};
