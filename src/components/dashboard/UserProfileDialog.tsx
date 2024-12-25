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

  const { data: subscription } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*, subscription_plans(*)')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });

  const getSubscriptionInfo = () => {
    if (!subscription) return "Loading subscription...";

    const planInfo = `${subscription.plan_type.charAt(0).toUpperCase() + subscription.plan_type.slice(1)} Plan`;
    
    if (subscription.status === 'trial' && subscription.trial_end_date) {
      const daysLeft = differenceInDays(
        new Date(subscription.trial_end_date),
        new Date()
      );
      
      return `${planInfo} (${daysLeft} days left in trial)`;
    }

    return planInfo;
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
            <p className="text-sm text-muted-foreground">{getSubscriptionInfo()}</p>
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