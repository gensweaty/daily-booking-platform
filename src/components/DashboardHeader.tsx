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
  const [isSigningOut, setIsSigningOut] = useState(false);

  const { data: subscription, error: subscriptionError } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      console.log('Fetching subscription for user:', user.id);
      
      const { data, error } = await supabase
        .from('subscriptions')
        .select(`
          *,
          subscription_plans (
            id,
            name,
            type,
            price
          )
        `)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Subscription fetch error:', error);
        throw error;
      }
      
      console.log('Fetched subscription data:', data);
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

  const handleSignOut = async () => {
    if (isSigningOut) return;
    
    setIsSigningOut(true);
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out error:', error);
      // No need to show a toast here as it's handled in the AuthContext
    } finally {
      setIsSigningOut(false);
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
            disabled={isSigningOut}
          >
            <LogOut className="w-4 h-4" />
            {isSigningOut ? "Signing out..." : "Sign Out"}
          </Button>
        </div>
      </div>

      <UserProfileDialog 
        open={showUserProfile}
        onOpenChange={setShowUserProfile}
        username={username}
      />

      <SubscriptionDialog 
        open={showSubscriptionDialog}
        onOpenChange={setShowSubscriptionDialog}
        isTrialExpired={isTrialExpired}
      />
    </header>
  );
};