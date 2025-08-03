
import React, { useState } from "react";
import { Calendar } from "@/components/Calendar/Calendar";
import { CustomerList } from "@/components/crm/CustomerList";
import { Statistics } from "@/components/Statistics";
import { BusinessPage } from "@/components/business/BusinessPage";
import { BookingRequestsList } from "@/components/business/BookingRequestsList";
import { EventReminderNotifications } from "@/components/events/EventReminderNotifications";
import { ReminderNotifications } from "@/components/reminder/ReminderNotifications";

export const DashboardContent = () => {
  const [activeSection, setActiveSection] = useState("calendar");

  return (
    <div className="min-h-screen bg-background">
      {/* Notification components */}
      <ReminderNotifications reminders={[]} />
      
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
