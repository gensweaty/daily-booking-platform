
import { useState } from "react";
import { DashboardHeader } from "./DashboardHeader";
import { TaskList } from "../TaskList";
import { Calendar } from "../Calendar/Calendar";
import { AddTaskForm } from "../AddTaskForm";
import { Statistics } from "../Statistics";
import { NoteList } from "../NoteList";
import { ReminderList } from "../ReminderList";
import { CustomerList } from "../crm/CustomerList";
import { BookingRequestsList } from "../business/BookingRequestsList";
import { TaskReminderNotifications } from "../tasks/TaskReminderNotifications";
import { EventReminderNotifications } from "../Calendar/EventReminderNotifications";

interface DashboardContentProps {
  activeSection: string;
  setActiveSection: (section: string) => void;
}

export const DashboardContent = ({ activeSection, setActiveSection }: DashboardContentProps) => {
  const [showNav, setShowNav] = useState(false);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);

  const renderContent = () => {
    switch (activeSection) {
      case "tasks":
        return (
          <>
            <TaskList />
            <AddTaskForm isOpen={isTaskDialogOpen} setIsOpen={setIsTaskDialogOpen} />
          </>
        );
      case "calendar":
        return <Calendar />;
      case "statistics":
        return <Statistics />;
      case "notes":
        return <NoteList />;
      case "reminders":
        return <ReminderList />;
      case "crm":
        return <CustomerList />;
      case "bookings":
        return <BookingRequestsList />;
      default:
        return <TaskList />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <TaskReminderNotifications />
      <EventReminderNotifications />
      
      <DashboardHeader 
        showNav={showNav}
        setShowNav={setShowNav}
      />
      
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {renderContent()}
      </main>
    </div>
  );
};
