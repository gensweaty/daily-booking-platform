import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle, ListTodo, Bell, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskList } from "@/components/TaskList";
import { ReminderList } from "@/components/ReminderList";
import { NoteList } from "@/components/NoteList";
import { useToast } from "@/components/ui/use-toast";

const Index = () => {
  const { toast } = useToast();

  const handleAddItem = (type: string) => {
    toast({
      title: "Coming soon!",
      description: `Adding new ${type} will be available soon.`,
    });
  };

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
              <Button onClick={() => handleAddItem('task')} className="flex items-center gap-2">
                <PlusCircle className="w-4 h-4" />
                Add Task
              </Button>
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
              <Button onClick={() => handleAddItem('reminder')} className="flex items-center gap-2">
                <PlusCircle className="w-4 h-4" />
                Add Reminder
              </Button>
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
              <Button onClick={() => handleAddItem('note')} className="flex items-center gap-2">
                <PlusCircle className="w-4 h-4" />
                Add Note
              </Button>
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