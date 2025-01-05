import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { User } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { Subscription } from "@/types/subscription";
import { useEffect, useState } from "react";

interface UserProfileDialogProps {
  user: SupabaseUser | null;
  username: string;
  subscription: Subscription | null;
}

export const UserProfileDialog = ({ user, username, subscription: initialSubscription }: UserProfileDialogProps) => {
  const { toast } = useToast();
  const [subscription, setSubscription] = useState(initialSubscription);

  useEffect(() => {
    const fetchSubscription = async () => {
      if (!user) return;

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

  const formatPlanType = (planType: string) => {
    return planType.charAt(0).toUpperCase() + planType.slice(1) + ' Plan';
  };

  const formatTimeLeft = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return `${daysLeft} days until next payment`;
  };

  return (
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
            <p className="text-sm font-medium">Subscription</p>
            {subscription && subscription.status === 'active' ? (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  {formatPlanType(subscription.plan_type)}
                </p>
                {subscription.current_period_end && (
                  <p className="text-xs text-muted-foreground">
                    {formatTimeLeft(subscription.current_period_end)}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No active subscription</p>
            )}
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