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
import { TrialExpiredDialog } from "@/components/TrialExpiredDialog";

// Separate component for subscription handling
const SubscriptionHandler = () => {
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const handleSubscription = async () => {
      const subscription = searchParams.get('subscription');
      const orderId = searchParams.get('orderId');

      if (subscription && orderId) {
        try {
          console.log('Processing subscription:', { subscription, orderId });
          
          const { data: session } = await supabase.auth.getSession();
          if (!session?.session?.access_token) {
            throw new Error('No access token available');
          }

          const response = await supabase.functions.invoke('handle-subscription-redirect', {
            body: { subscription, orderId }
          });

          if (response.error) {
            throw new Error(response.error.message || 'Failed to activate subscription');
          }

          toast({
            title: "Success",
            description: "Your subscription has been activated!",
            duration: 5000,
          });

          // Remove query parameters and reload to update subscription status
          navigate('/dashboard', { replace: true });
          window.location.reload();
        } catch (error: any) {
          console.error('Subscription activation error:', error);
          toast({
            title: "Error",
            description: error.message || "Failed to activate subscription",
            variant: "destructive",
            duration: 5000,
          });
        }
      }
    };

    handleSubscription();
  }, [searchParams, toast, navigate]);

  return null;
};

// Main dashboard content component
const DashboardContent = ({ username }: { username: string }) => {
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);

  return (
    <Tabs defaultValue="calendar" className="w-full max-w-[90%] xl:max-w-[85%] 2xl:max-w-[80%] mx-auto">
      <TabsList className="grid w-full grid-cols-3 mb-8">
        <TabsTrigger value="calendar" className="flex items-center gap-2 text-sm sm:text-base text-foreground">
          <CalendarIcon className="w-4 h-4" />
          <span className="hidden sm:inline">Booking Calendar</span>
        </TabsTrigger>
        <TabsTrigger value="statistics" className="flex items-center gap-2 text-sm sm:text-base text-foreground">
          <BarChart className="w-4 h-4" />
          <span className="hidden sm:inline">Statistics</span>
        </TabsTrigger>
        <TabsTrigger value="tasks" className="flex items-center gap-2 text-sm sm:text-base text-foreground">
          <ListTodo className="w-4 h-4" />
          <span className="hidden sm:inline">Tasks</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="calendar">
        <Card className="min-h-[calc(100vh-12rem)]">
          <CardContent className="pt-6 overflow-x-auto">
            <Calendar defaultView="month" />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="statistics">
        <Card className="min-h-[calc(100vh-12rem)]">
          <CardHeader>
            <CardTitle className="text-foreground">Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <Statistics />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="tasks">
        <Card className="min-h-[calc(100vh-12rem)]">
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
    </Tabs>
  );
};

const Index = () => {
  const [username, setUsername] = useState("");
  const [showTrialExpired, setShowTrialExpired] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const checkSubscriptionStatus = async () => {
      if (user) {
        try {
          console.log('Checking subscription status for user:', user.id);
          const { data: subscription, error } = await supabase
            .from('subscriptions')
            .select('status, current_period_end, trial_end_date, plan_type')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (error) {
            console.error('Error checking subscription:', error);
            return;
          }

          console.log('Fetched subscription:', subscription);

          if (!subscription || 
              subscription.status === 'expired' || 
              (subscription.current_period_end && new Date(subscription.current_period_end) < new Date())) {
            console.log('Setting showTrialExpired to true');
            setShowTrialExpired(true);
          } else {
            console.log('Setting showTrialExpired to false');
            setShowTrialExpired(false);
          }
        } catch (error) {
          console.error('Subscription check error:', error);
        }
      }
    };

    checkSubscriptionStatus();
  }, [user]);

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
      {showTrialExpired && <TrialExpiredDialog />}
      <SubscriptionHandler />
      <DashboardHeader username={username} />
      <DashboardContent username={username} />
    </div>
  );
};

export default Index;