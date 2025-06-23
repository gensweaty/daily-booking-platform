import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { TaskList } from "@/components/TaskList";
import { AddTaskForm } from "@/components/AddTaskForm";
import { NoteList } from "@/components/NoteList";
import { AddNoteForm } from "@/components/AddNoteForm";
import { ReminderList } from "@/components/ReminderList";
import { AddReminderForm } from "@/components/AddReminderForm";
import { Calendar } from "@/components/Calendar/Calendar";
import { Statistics } from "@/components/Statistics";
import { TaskReminderNotifications } from "@/components/tasks/TaskReminderNotifications";
import { useLanguage } from "@/contexts/LanguageContext";

export const DashboardContent = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [isAddNoteOpen, setIsAddNoteOpen] = useState(false);
  const [isAddReminderOpen, setIsAddReminderOpen] = useState(false);
  const { t } = useLanguage();

  const renderAddButton = () => {
    switch (activeTab) {
      case "tasks":
        return (
          <Button onClick={() => setIsAddTaskOpen(true)} className="mb-4">
            <Plus className="h-4 w-4 mr-2" />
            {t("tasks.addTask")}
          </Button>
        );
      case "notes":
        return (
          <Button onClick={() => setIsAddNoteOpen(true)} className="mb-4">
            <Plus className="h-4 w-4 mr-2" />
            {t("notes.addNewNote")}
          </Button>
        );
      case "reminders":
        return (
          <Button onClick={() => setIsAddReminderOpen(true)} className="mb-4">
            <Plus className="h-4 w-4 mr-2" />
            Add Reminder
          </Button>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <TaskReminderNotifications />
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">{t("dashboard.overview")}</TabsTrigger>
          <TabsTrigger value="calendar">{t("dashboard.calendar")}</TabsTrigger>
          <TabsTrigger value="tasks">{t("dashboard.tasks")}</TabsTrigger>
          <TabsTrigger value="notes">{t("dashboard.notes")}</TabsTrigger>
          <TabsTrigger value="reminders">{t("dashboard.reminders")}</TabsTrigger>
        </TabsList>

        <div className="mt-6">
          {renderAddButton()}
        </div>

        <TabsContent value="overview" className="space-y-6">
          <Statistics />
        </TabsContent>

        <TabsContent value="calendar" className="space-y-6">
          <Calendar />
        </TabsContent>

        <TabsContent value="tasks" className="space-y-6">
          <TaskList />
        </TabsContent>

        <TabsContent value="notes" className="space-y-6">
          <NoteList />
        </TabsContent>

        <TabsContent value="reminders" className="space-y-6">
          <ReminderList />
        </TabsContent>
      </Tabs>

      <Dialog open={isAddTaskOpen} onOpenChange={setIsAddTaskOpen}>
        <DialogContent className="bg-background border-border">
          <AddTaskForm onClose={() => setIsAddTaskOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={isAddNoteOpen} onOpenChange={setIsAddNoteOpen}>
        <DialogContent className="bg-background border-border">
          <AddNoteForm onClose={() => setIsAddNoteOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={isAddReminderOpen} onOpenChange={setIsAddReminderOpen}>
        <DialogContent className="bg-background border-border">
          <AddReminderForm onClose={() => setIsAddReminderOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
};
