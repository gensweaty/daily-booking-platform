import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { PlusCircle, ListTodo, Calendar as CalendarIcon, BarChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskList } from "@/components/TaskList";
import { Calendar } from "@/components/Calendar/Calendar";
import { AddTaskForm } from "@/components/AddTaskForm";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import { useSearchParams, useNavigate } from "react-router-dom";
import { AuthUI } from "@/components/AuthUI";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Statistics } from "@/components/Statistics";

const Index = () => {
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [username, setUsername] = useState("");
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const confirmationStatus = searchParams.get("email_confirmed");
    if (confirmationStatus === "true") {
      toast({
        title: "Email Confirmed",
        description: "Thank you! Your email has been successfully confirmed.",
        duration: 5000,
      });
      navigate("/login");
    }
  }, [searchParams, toast, navigate]);

  useEffect(() => {
    const getProfile = async () => {
      if (user) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', user.id)
            .maybeSingle();
          
          if (error) {
            console.error('Error fetching profile:', error);
            return;
          }
          
          if (data) {
            setUsername(data.username);
          }
        } catch (error: any) {
          console.error('Profile fetch error:', error);
        }
      }
    };

    getProfile();
  }, [user]);

  if (!user) {
    return <AuthUI />;
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <DashboardHeader username={username} />

      <Tabs defaultValue="calendar" className="w-full max-w-4xl mx-auto">
        <TabsList className="grid w-full grid-cols-3 mb-8">
          <TabsTrigger value="calendar" className="flex items-center gap-2 text-sm sm:text-base text-foreground">
            <CalendarIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Booking Calendar</span>
          </TabsTrigger>
          <TabsTrigger value="tasks" className="flex items-center gap-2 text-sm sm:text-base text-foreground">
            <ListTodo className="w-4 h-4" />
            <span className="hidden sm:inline">Tasks</span>
          </TabsTrigger>
          <TabsTrigger value="statistics" className="flex items-center gap-2 text-sm sm:text-base text-foreground">
            <BarChart className="w-4 h-4" />
            <span className="hidden sm:inline">Statistics</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar">
          <Card>
            <CardContent className="pt-6 overflow-x-auto">
              <Calendar defaultView="month" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
              <CardTitle className="text-foreground">My Tasks</CardTitle>
              <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="flex items-center gap-2 w-full sm:w-auto bg-primary hover:bg-primary/90 text-white">
                    <PlusCircle className="w-4 h-4" />
                    Add Task
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <AddTaskForm onClose={() => setIsTaskDialogOpen(false)} />
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <TaskList />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="statistics">
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground">Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <Statistics />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Index;