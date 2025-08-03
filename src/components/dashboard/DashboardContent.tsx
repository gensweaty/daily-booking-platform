import React, { useState } from "react";
import { Calendar } from "@/components/Calendar/Calendar";
import { CustomerList } from "@/components/CRM/CustomerList";
import { Statistics } from "@/components/Statistics/Statistics";
import { BusinessPage } from "@/components/Business/BusinessPage";
import { BookingRequestsList } from "@/components/BookingRequests/BookingRequestsList";
import { EventReminderNotifications } from "@/components/EventReminders/EventReminderNotifications";
import { ReminderNotificationManager } from "@/components/reminder/ReminderNotificationManager";

export const DashboardContent = () => {
  const [activeSection, setActiveSection] = useState("calendar");

  return (
    <div className="min-h-screen bg-background">
      {/* Notification components */}
      <ReminderNotificationManager onClose={() => {}} />
      
      {/* Calendar Section */}
      {activeSection === "calendar" && (
        <div className="container mx-auto px-4 py-6">
          <Calendar />
        </div>
      )}
      
      {/* CRM Section */}
      {activeSection === "crm" && (
        <div className="container mx-auto px-4 py-6">
          <CustomerList />
        </div>
      )}

      {/* Statistics Section */}
      {activeSection === "statistics" && (
        <div className="container mx-auto px-4 py-6">
          <Statistics />
        </div>
      )}

      {/* Business Section */}
      {activeSection === "business" && (
        <div className="container mx-auto px-4 py-6">
          <BusinessPage />
        </div>
      )}

      {/* Business Requests Section */}
      {activeSection === "business-requests" && (
        <div className="container mx-auto px-4 py-6">
          <BookingRequestsList businessId="" />
        </div>
      )}

      {/* Event Reminder Notifications */}
      <EventReminderNotifications businessId="" />
    </div>
  );
};
