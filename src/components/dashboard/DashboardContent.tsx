import { useState } from "react";
import { TaskList } from "@/components/tasks/TaskList";
import { TaskCreate } from "@/components/tasks/TaskCreate";
import { Calendar } from "@/components/Calendar/Calendar";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { TaskReminderNotifications } from "@/components/tasks/TaskReminderNotifications";
import { EventReminderNotifications } from "@/components/Calendar/EventReminderNotifications";

export const DashboardContent = () => {
  const [activeSection, setActiveSection] = useState<'tasks' | 'calendar'>('tasks');
  const [showNav, setShowNav] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Add EventReminderNotifications component */}
      <TaskReminderNotifications />
      <EventReminderNotifications />
      
      <DashboardHeader 
        activeSection={activeSection} 
        setActiveSection={setActiveSection}
        showNav={showNav}
        setShowNav={setShowNav}
      />

      <div className="p-4 sm:ml-64">
        {activeSection === 'tasks' && (
          <>
            <TaskCreate />
            <TaskList />
          </>
        )}

        {activeSection === 'calendar' && (
          <Calendar />
        )}
      </div>
    </div>
  );
};
