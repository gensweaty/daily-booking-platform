
import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Statistics } from '@/components/Statistics';
import { NoteList } from '@/components/NoteList';
import { TaskList } from '@/components/TaskList';
import { CalendarComponent } from '@/components/Calendar/Calendar';
import { CustomerList } from '@/components/crm/CustomerList';
import { BusinessPage } from '@/components/business/BusinessPage';
import { ArchivedTasksPage } from '@/components/tasks/ArchivedTasksPage';
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

  const renderContent = () => {
    switch (activeSection) {
      case 'statistics':
        return <Statistics />;
      case 'notes':
        return <NoteList />;
      case 'tasks':
        return <TaskList />;
      case 'calendar':
        return <CalendarComponent />;
      case 'crm':
        return <CustomerList />;
      case 'booking-requests':
        return (
          <div className="flex items-center justify-center h-64">
            <p className="text-lg text-gray-500">
              {isGeorgian ? (
                <GeorgianAuthText>ბრონირების მოთხოვნები</GeorgianAuthText>
              ) : (
                <LanguageText>Booking Requests</LanguageText>
              )}
            </p>
          </div>
        );
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
      {renderContent()}
    </div>
  );
};
