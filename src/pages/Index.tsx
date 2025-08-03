
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardContent } from '@/components/dashboard/DashboardContent';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageText } from '@/components/shared/LanguageText';
import { GeorgianAuthText } from '@/components/shared/GeorgianAuthText';

const Index: React.FC = () => {
  const { user, loading } = useAuth();
  const { language } = useLanguage();
  const isGeorgian = language === 'ka';
  const [activeSection, setActiveSection] = useState('statistics');

  useEffect(() => {
    if (!loading && !user) {
      window.location.href = '/auth/login';
    }
  }, [user, loading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-lg text-gray-500">
          {isGeorgian ? (
            <GeorgianAuthText>იტვირთება...</GeorgianAuthText>
          ) : (
            <LanguageText>Loading...</LanguageText>
          )}
        </p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex items-center justify-between p-4 border-b">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setActiveSection('statistics')}
            className={`px-3 py-2 rounded ${activeSection === 'statistics' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
          >
            {isGeorgian ? <GeorgianAuthText>სტატისტიკა</GeorgianAuthText> : <LanguageText>Statistics</LanguageText>}
          </button>
          <button
            onClick={() => setActiveSection('calendar')}
            className={`px-3 py-2 rounded ${activeSection === 'calendar' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
          >
            {isGeorgian ? <GeorgianAuthText>კალენდარი</GeorgianAuthText> : <LanguageText>Calendar</LanguageText>}
          </button>
          <button
            onClick={() => setActiveSection('tasks')}
            className={`px-3 py-2 rounded ${activeSection === 'tasks' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
          >
            {isGeorgian ? <GeorgianAuthText>ამოცანები</GeorgianAuthText> : <LanguageText>Tasks</LanguageText>}
          </button>
          <button
            onClick={() => setActiveSection('notes')}
            className={`px-3 py-2 rounded ${activeSection === 'notes' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
          >
            {isGeorgian ? <GeorgianAuthText>შენიშვნები</GeorgianAuthText> : <LanguageText>Notes</LanguageText>}
          </button>
        </div>
      </div>
      
      <DashboardContent 
        activeSection={activeSection}
        setActiveSection={setActiveSection}
      />
    </div>
  );
};

export default Index;
