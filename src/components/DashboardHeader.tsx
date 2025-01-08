import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import { UserProfileContent } from "@/components/profile/UserProfileContent";

interface DashboardHeaderProps {
  username: string;
}

interface Subscription {
  plan_type: string;
  status: string;
  current_period_end: string | null;
  current_period_start: string | null;
  trial_end_date: string | null;
}

export const DashboardHeader = ({ username }: DashboardHeaderProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState<Subscription | null>(null);

  useEffect(() => {
    const fetchSubscription = async () => {
      if (user) {
        try {
          const { data, error } = await supabase
            .from('subscriptions')
            .select('plan_type, status, current_period_start, current_period_end, trial_end_date')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (error) {
            console.error('Error fetching subscription:', error);
            return;
          }

          console.log('Fetched subscription:', data);
          setSubscription(data);
        } catch (error) {
          console.error('Subscription fetch error:', error);
        }
      }
    };

    fetchSubscription();
  }, [user]);

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      navigate('/login');
    } catch (error: any) {
      console.error('Sign out error:', error);
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleChangePassword = async () => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user?.email || '', {
        redirectTo: 'https://daily-booking-platform.lovable.app/reset-password',
      });

      if (error) throw error;

      toast({
        title: "Password Reset Email Sent",
        description: "Please check your email for the password reset link.",
      });
    } catch (error: any) {
      console.error('Password reset error:', error);
      toast({
        title: "Error",
        description: "Failed to send password reset email. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <header className="mb-8">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="text-center sm:text-left">
          <h1 className="text-2xl sm:text-4xl font-bold text-primary mb-2">Welcome to Taskify Minder Note</h1>
          <p className="text-foreground">
            {username ? `Hello ${username}!` : 'Welcome!'} Complete Agile productivity - tasks notes calendar all in one
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button 
                variant="outline" 
                size="icon"
                className="text-foreground"
              >
                <User className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>User Profile</DialogTitle>
              </DialogHeader>
              <UserProfileContent 
                user={user}
                username={username}
                subscription={subscription}
                onChangePassword={handleChangePassword}
              />
            </DialogContent>
          </Dialog>
          <ThemeToggle />
          <Button 
            variant="outline" 
            className="flex items-center gap-2 text-foreground"
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>
      </div>
    </header>
  );
};