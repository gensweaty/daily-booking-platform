
import { useState } from "react";
import { TaskList } from "../TaskList";
import { AddTaskForm } from "../AddTaskForm";
import { AddNoteForm } from "../AddNoteForm";
import { AddReminderForm } from "../AddReminderForm";
import { NoteList } from "../NoteList";
import { ReminderList } from "../ReminderList";
import { Statistics } from "../Statistics";
import { BusinessProfileForm } from "../business/BusinessProfileForm";
import { BookingRequestsList } from "../business/BookingRequestsList";
import { CalendarView } from "../Calendar/CalendarView";
import { CustomerList } from "../crm/CustomerList";
import { Task } from "@/lib/types";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { TaskReminderNotifications } from "../tasks/TaskReminderNotifications";

interface DashboardContentProps {
  activeSection: string;
}

export const DashboardContent = ({ activeSection }: DashboardContentProps) => {
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
  const [isReminderDialogOpen, setIsReminderDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const handleTaskEdit = (task: Task) => {
    setEditingTask(task);
    setIsTaskDialogOpen(true);
  };

  const handleTaskDialogClose = () => {
    setIsTaskDialogOpen(false);
    setEditingTask(null);
  };

  const handleAddTask = () => {
    setEditingTask(null);
    setIsTaskDialogOpen(true);
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'overview':
        return <Statistics />;
      case 'calendar':
        return <CalendarView />;
      case 'tasks':
        return (
          <TaskList 
            onAddTask={handleAddTask}
            onEditTask={handleTaskEdit}
          />
        );
      case 'reminders':
        return (
          <ReminderList 
            onAddReminder={() => setIsReminderDialogOpen(true)}
          />
        );
      case 'notes':
        return (
          <NoteList 
            onAddNote={() => setIsNoteDialogOpen(true)}
          />
        );
      case 'business':
        return <BusinessProfileForm />;
      case 'bookings':
        return <BookingRequestsList />;
      case 'crm':
        return <CustomerList />;
      default:
        return <Statistics />;
    }
  };

  return (
    <>
      {/* Task Reminder Notifications */}
      <TaskReminderNotifications />
      
      {renderContent()}
      
      {/* Task Dialog */}
      <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <AddTaskForm 
            onClose={handleTaskDialogClose}
            editingTask={editingTask}
          />
        </DialogContent>
      </Dialog>

      {/* Note Dialog */}
      <Dialog open={isNoteDialogOpen} onOpenChange={setIsNoteDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <AddNoteForm />
        </DialogContent>
      </Dialog>

      {/* Reminder Dialog */}
      <Dialog open={isReminderDialogOpen} onOpenChange={setIsReminderDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <AddReminderForm />
        </DialogContent>
      </Dialog>
    </>
  );
};
