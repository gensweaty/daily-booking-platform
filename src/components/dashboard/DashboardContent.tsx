
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { TaskList } from "@/components/TaskList";
import { NoteList } from "@/components/NoteList";
import { ReminderList } from "@/components/ReminderList";
import { Statistics } from "@/components/Statistics";
import { Calendar } from "@/components/Calendar/Calendar";
import AddTaskForm from "@/components/AddTaskForm";
import { AddNoteForm } from "@/components/AddNoteForm";
import { AddReminderForm } from "@/components/AddReminderForm";
import { CustomerList } from "@/components/crm/CustomerList";
import { TaskReminderNotifications } from "@/components/tasks/TaskReminderNotifications";
import { EventReminderNotifications } from "@/components/Calendar/EventReminderNotifications";
import { ReminderNotifications } from "@/components/reminder/ReminderNotifications";
import { useState } from "react";
import { LanguageText } from "@/components/shared/LanguageText";

export const DashboardContent = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [showAddTaskForm, setShowAddTaskForm] = useState(false);
  const [showAddNoteForm, setShowAddNoteForm] = useState(false);
  const [showAddReminderForm, setShowAddReminderForm] = useState(false);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">
            <LanguageText>Please sign in to access your dashboard</LanguageText>
          </h2>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Notification Components */}
      <TaskReminderNotifications />
      <EventReminderNotifications />
      
      {/* Calendar Section */}
      <div>
        <Calendar />
      </div>

      {/* Statistics */}
      <div>
        <Statistics />
      </div>

      {/* Tasks Section */}
      <div>
        <TaskList />
      </div>

      {/* Notes Section */}
      <div>
        <NoteList />
      </div>

      {/* Reminders Section */}
      <div>
        <ReminderList />
      </div>

      {/* CRM Section */}
      <div>
        <CustomerList />
      </div>

      {/* Modal Forms */}
      {showAddTaskForm && (
        <AddTaskForm onClose={() => setShowAddTaskForm(false)} />
      )}

      {showAddNoteForm && (
        <AddNoteForm 
          onClose={() => setShowAddNoteForm(false)}
          onSave={() => setShowAddNoteForm(false)} 
        />
      )}

      {showAddReminderForm && (
        <AddReminderForm onClose={() => setShowAddReminderForm(false)} />
      )}
    </div>
  );
};
