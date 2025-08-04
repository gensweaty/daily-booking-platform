
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Calendar } from "@/components/Calendar/Calendar";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Statistics } from "@/components/Statistics";
import { TaskList } from "@/components/TaskList";
import { NoteList } from "@/components/NoteList";
import { ReminderList } from "@/components/ReminderList";
import { CustomerList } from "@/components/crm/CustomerList";
import { BusinessProfileForm } from "@/components/business/BusinessProfileForm";
import { BookingRequestsList } from "@/components/business/BookingRequestsList";
import { CalendarViewType } from "@/lib/types/calendar";
import { ArchivedTasksPage } from "@/components/tasks/ArchivedTasksPage";
import { ReminderNotificationManager } from "@/components/reminder/ReminderNotificationManager";
import { TaskReminderNotifications } from "@/components/tasks/TaskReminderNotifications";
import { EventReminderNotifications } from "@/components/Calendar/EventReminderNotifications";
import { BookingNotificationManager } from "@/components/business/BookingNotificationManager";
import { useBookingRequests } from "@/hooks/useBookingRequests";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type DashboardView = 
  | "calendar"
  | "statistics" 
  | "tasks"
  | "notes"
  | "reminders"
  | "crm"
  | "business"
  | "bookings"
  | "archived-tasks";

interface DashboardContentProps {
  currentView: DashboardView;
  onViewChange: (view: DashboardView) => void;
}

export const DashboardContent = ({ currentView, onViewChange }: DashboardContentProps) => {
  const { user } = useAuth();
  const [calendarView, setCalendarView] = useState<CalendarViewType>("week");
  
  const { bookingRequests, deleteBookingRequest } = useBookingRequests(user?.id);

  // Fetch reminders for ReminderNotificationManager
  const { data: reminders = [] } = useQuery({
    queryKey: ['reminders', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('user_id', user.id)
        .order('remind_at', { ascending: true });
      
      if (error) {
        console.error('Error fetching reminders:', error);
        return [];
      }
      
      return data || [];
    },
    enabled: !!user?.id,
  });

  if (!user) return null;

  const renderContent = () => {
    switch (currentView) {
      case "calendar":
        return (
          <Calendar 
            defaultView={calendarView}
            currentView={calendarView}
            onViewChange={setCalendarView}
          />
        );
      case "statistics":
        return <Statistics />;
      case "tasks":
        return <TaskList />;
      case "notes":
        return <NoteList />;
      case "reminders":
        return <ReminderList />;
      case "crm":
        return <CustomerList />;
      case "business":
        return <BusinessProfileForm />;
      case "bookings":
        return <BookingRequestsList requests={bookingRequests || []} onDelete={deleteBookingRequest} />;
      case "archived-tasks":
        return <ArchivedTasksPage />;
      default:
        return (
          <Calendar 
            defaultView={calendarView}
            currentView={calendarView}
            onViewChange={setCalendarView}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader 
        view={currentView} 
        onViewChange={onViewChange}
        username={user?.email || "User"}
      />
      
      <main className="container mx-auto px-4 py-6">
        {renderContent()}
      </main>

      {/* Notification managers */}
      <ReminderNotificationManager reminders={reminders} />
      <TaskReminderNotifications />
      <EventReminderNotifications />
      <BookingNotificationManager businessProfileId={user?.id || ""} />
    </div>
  );
};
