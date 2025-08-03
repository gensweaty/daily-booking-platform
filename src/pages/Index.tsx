import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';
import { DashboardContent } from '@/components/dashboard/DashboardContent';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import { TaskDialog } from '@/components/tasks/TaskDialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageText } from '@/components/shared/LanguageText';
import { GeorgianAuthText } from '@/components/shared/GeorgianAuthText';

const Index: React.FC = () => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { language } = useLanguage();
  const isGeorgian = language === 'ka';
  const [activeSection, setActiveSection] = useState('statistics');
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [user, loading, router]);

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
      <DashboardHeader 
        activeSection={activeSection}
        setActiveSection={setActiveSection}
      />
      
      <div className="flex">
        <DashboardSidebar 
          activeSection={activeSection}
          setActiveSection={setActiveSection}
        />
        
        <DashboardContent 
          activeSection={activeSection}
          setActiveSection={setActiveSection}
        />
      </div>
      
      <TaskDialog
        isOpen={isTaskDialogOpen}
        onOpenChange={setIsTaskDialogOpen}
      />
    </div>
  );
};

export default Index;
