import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { PlusCircle, ListTodo, Bell, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskList } from "@/components/TaskList";
import { ReminderList } from "@/components/ReminderList";
import { NoteList } from "@/components/NoteList";
import { AddTaskForm } from "@/components/AddTaskForm";
import { AddReminderForm } from "@/components/AddReminderForm";
import { AddNoteForm } from "@/components/AddNoteForm";
import { SignIn } from "@/components/SignIn";
import { SignUp } from "@/components/SignUp";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

const Index = () => {
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [isReminderDialogOpen, setIsReminderDialogOpen] = useState(false);
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-primary mb-2">Taskify Minder Note</h1>
          <p className="text-gray-600">Please sign in or sign up to continue</p>
        </header>
        
        <Tabs defaultValue="signin" className="w-full max-w-md mx-auto">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>
          <TabsContent value="signin">
            <SignIn />
          </TabsContent>
          <TabsContent value="signup">
            <SignUp />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-primary mb-2">Taskify Minder Note</h1>
        <p className="text-gray-600">Manage your tasks, reminders, and notes in one place</p>
      </header>

      <Tabs defaultValue="tasks" className="w-full max-w-4xl mx-auto">
        <TabsList className="grid w-full grid-cols-3 mb-8">
          <TabsTrigger value="tasks" className="flex items-center gap-2">
            <ListTodo className="w-4 h-4" />
            Tasks
          </TabsTrigger>
          <TabsTrigger value="reminders" className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Reminders
          </TabsTrigger>
          <TabsTrigger value="notes" className="flex items-center gap-2">
            <StickyNote className="w-4 h-4" />
            Notes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tasks">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>My Tasks</CardTitle>
              <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="flex items-center gap-2">
                    <PlusCircle className="w-4 h-4" />
                    Add Task
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <AddTaskForm onClose={() => setIsTaskDialogOpen(false)} />
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <TaskList />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reminders">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>My Reminders</CardTitle>
              <Dialog open={isReminderDialogOpen} onOpenChange={setIsReminderDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="flex items-center gap-2">
                    <PlusCircle className="w-4 h-4" />
                    Add Reminder
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <AddReminderForm onClose={() => setIsReminderDialogOpen(false)} />
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <ReminderList />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>My Notes</CardTitle>
              <Dialog open={isNoteDialogOpen} onOpenChange={setIsNoteDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="flex items-center gap-2">
                    <PlusCircle className="w-4 h-4" />
                    Add Note
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <AddNoteForm onClose={() => setIsNoteDialogOpen(false)} />
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <NoteList />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Index;