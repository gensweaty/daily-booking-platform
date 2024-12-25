import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { differenceInDays } from "date-fns";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { useState, useEffect } from "react";
import { UserProfileDialog } from "./dashboard/UserProfileDialog";
import { SubscriptionDialog } from "./dashboard/SubscriptionDialog";

interface DashboardHeaderProps {
  username: string;
}

export const DashboardHeader = ({ username }: DashboardHeaderProps) => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [showSubscriptionDialog, setShowSubscriptionDialog] = useState(false);

  const { data: subscription, error: subscriptionError } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*, subscription_plans(*)')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Subscription fetch error:', error);
        throw error;
      }
      
      return data;
    },
    enabled: !!user?.id,
    retry: 1,
    meta: {
      errorMessage: "Failed to fetch subscription information"
    },
  });

  const isTrialExpired = subscription?.status === 'trial' && 
    differenceInDays(new Date(subscription.trial_end_date || ''), new Date()) <= 0;

  useEffect(() => {
    if (isTrialExpired) {
      setShowSubscriptionDialog(true);
    }
  }, [isTrialExpired]);

  const getSubscriptionInfo = () => {
    if (subscriptionError) return "Error loading subscription";
    if (!subscription) return "Loading subscription...";

    const planName = subscription.subscription_plans?.name || subscription.plan_type;

    if (subscription.status === 'trial' && subscription.trial_end_date) {
      const daysLeft = differenceInDays(
        new Date(subscription.trial_end_date),
        new Date()
      );
      
      if (daysLeft <= 0) {
        return "Trial expired";
      }
      
      return `${planName} (${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} remaining in trial)`;
    }

    if (subscription.status === 'expired') {
      return "Trial expired";
    }

    if (subscription.status === 'active') {
      return planName;
    }

    return "No active subscription";
  };

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
          <h1 className="text-2xl sm:text-4xl font-bold text-primary mb-2">
            Welcome to Taskify Minder Note
          </h1>
          <p className="text-foreground">
            {username ? `Hello ${username}!` : 'Welcome!'} Complete Agile productivity - tasks notes calendar all in one
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={showUserProfile} onOpenChange={setShowUserProfile}>
            <DialogTrigger asChild>
              <Button 
                variant="outline" 
                size="icon"
                className="text-foreground"
              >
                <User className="w-4 h-4" />
              </Button>
            </DialogTrigger>
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

      <UserProfileDialog 
        open={showUserProfile}
        onOpenChange={setShowUserProfile}
        username={username}
        subscriptionInfo={getSubscriptionInfo()}
      />

      <SubscriptionDialog 
        open={showSubscriptionDialog}
        onOpenChange={setShowSubscriptionDialog}
        isTrialExpired={isTrialExpired}
      />
    </header>
  );
};