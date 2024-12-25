import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import { useQuery } from "@tanstack/react-query";
import { differenceInDays } from "date-fns";

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
      
      const { data: subscriptionData, error: subscriptionError } = await supabase
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

      if (subscriptionError) {
        console.error('Subscription fetch error:', subscriptionError);
        throw subscriptionError;
      }

      if (!subscriptionData) {
        // If no subscription exists, create a trial subscription
        const { data: plans } = await supabase
          .from('subscription_plans')
          .select('*')
          .eq('type', 'free')
          .single();

        if (!plans) throw new Error('No free plan found');

        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + 14); // 14 days trial

        const { data: newSubscription, error: createError } = await supabase
          .from('subscriptions')
          .insert([
            {
              user_id: user.id,
              plan_id: plans.id,
              status: 'trial',
              plan_type: 'monthly',
              trial_end_date: trialEndDate.toISOString(),
            }
          ])
          .select(`
            *,
            subscription_plans (
              id,
              name,
              type,
              price
            )
          `)
          .single();

        if (createError) throw createError;
        return newSubscription;
      }

      return subscriptionData;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    retry: 2,
  });

  const getFormattedSubscriptionInfo = () => {
    if (isLoading) return "Loading subscription info...";
    
    if (!subscription || !subscription.subscription_plans) {
      return "No subscription found";
    }

    const plan = subscription.subscription_plans;
    const planType = subscription.plan_type === 'monthly' ? '(Monthly)' : '(Yearly)';
    
    if (subscription.status === 'trial' && subscription.trial_end_date) {
      const daysLeft = differenceInDays(
        new Date(subscription.trial_end_date),
        new Date()
      );
      
      if (daysLeft <= 0) {
        return `${plan.name} ${planType} - Trial expired`;
      }
      
      return `${plan.name} ${planType} - ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} remaining in trial`;
    }

    if (subscription.status === 'active') {
      return `${plan.name} ${planType} - Active`;
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