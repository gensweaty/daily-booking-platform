import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { UserProfileDialog } from "./dashboard/UserProfileDialog";
import { Subscription } from "@/types/subscription";

interface DashboardHeaderProps {
  username: string;
}

export const DashboardHeader = ({ username }: DashboardHeaderProps) => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState<Subscription | null>(null);

  useEffect(() => {
    const fetchSubscription = async () => {
      if (user) {
        try {
          const { data, error } = await supabase
            .from('subscriptions')
            .select('plan_type, status, current_period_end')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .maybeSingle();

          if (error) {
            console.error('Error fetching subscription:', error);
            return;
          }

          setSubscription(data);
        } catch (error) {
          console.error('Error in subscription fetch:', error);
        }
      }
    };

    fetchSubscription();
    
    // Set up real-time subscription updates
    const channel = supabase
      .channel('subscription-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscriptions',
          filter: `user_id=eq.${user?.id}`
        },
        () => {
          fetchSubscription();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Sign out error:', error);
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
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
          <UserProfileDialog 
            user={user}
            username={username}
            subscription={subscription}
          />
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