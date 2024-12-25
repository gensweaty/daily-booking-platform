import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import { useQuery } from "@tanstack/react-query";
import { differenceInDays, parseISO } from "date-fns";

interface UserProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  username: string;
}

export const UserProfileDialog = ({ open, onOpenChange, username }: UserProfileDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: subscription, isLoading } = useQuery({
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
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    refetchInterval: 1000 * 60 * 60 * 24, // Refetch every 24 hours to update trial days
    retry: 2,
  });

  const getFormattedSubscriptionInfo = () => {
    if (isLoading) return "Loading subscription info...";
    
    if (!subscription) {
      console.log('No subscription found for user:', user?.id);
      return "No subscription found. Please contact support.";
    }

    if (!subscription.subscription_plans) {
      console.log('No subscription plan found for subscription:', subscription);
      return "Subscription plan details not found. Please contact support.";
    }

    const plan = subscription.subscription_plans;
    const planType = subscription.plan_type === 'monthly' ? '(Monthly)' : '(Yearly)';
    
    if (subscription.status === 'trial') {
      const daysLeft = subscription.trial_end_date 
        ? differenceInDays(parseISO(subscription.trial_end_date), new Date())
        : 0;
      
      return `${plan.name} ${planType} - ${Math.max(0, daysLeft)} days remaining in trial`;
    }

    if (subscription.status === 'active') {
      return `${plan.name} ${planType} - Active subscription`;
    }

    if (subscription.status === 'expired') {
      return `${plan.name} ${planType} - Trial expired`;
    }

    return `${plan.name} ${planType} - ${subscription.status}`;
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>User Profile</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Email</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Username</p>
            <p className="text-sm text-muted-foreground">{username}</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Subscription Status</p>
            <p className="text-sm text-muted-foreground">{getFormattedSubscriptionInfo()}</p>
          </div>
          <div className="pt-4">
            <Button 
              variant="outline" 
              className="w-full"
              onClick={handleChangePassword}
            >
              Change Password
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};