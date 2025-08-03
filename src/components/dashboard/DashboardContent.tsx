
import React from "react";
import { Calendar } from "@/components/Calendar/Calendar";
import { TaskReminderNotifications } from "@/components/tasks/TaskReminderNotifications";
import { EventReminderNotifications } from "@/components/events/EventReminderNotifications";
import { ReminderNotificationManager } from "@/components/reminder/ReminderNotificationManager";
import { BookingNotificationManager } from "@/components/business/BookingNotificationManager";
import { useAuth } from "@/contexts/AuthContext";
import { useBusinessProfile } from "@/hooks/useBusinessProfile";

export const DashboardContent = () => {
  const { user } = useAuth();
  const { data: businessProfile } = useBusinessProfile();

  return (
    <div className="min-h-screen">
      {/* Background notification components */}
      <TaskReminderNotifications />
      <EventReminderNotifications businessId={businessProfile?.id} />
      <ReminderNotificationManager />
      {businessProfile && (
        <BookingNotificationManager businessId={businessProfile.id} />
      )}
      
      {/* Main calendar content */}
      <Calendar />
    </div>
  );
};
