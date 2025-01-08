import { Button } from "@/components/ui/button";
import { SubscriptionInfo } from "@/components/subscription/SubscriptionInfo";
import { User } from "@supabase/supabase-js";

interface UserProfileContentProps {
  user: User | null;
  username: string;
  subscription: {
    plan_type: string;
    status: string;
    current_period_end: string | null;
    current_period_start: string | null;
    trial_end_date: string | null;
  } | null;
  onChangePassword: () => void;
}

export const UserProfileContent = ({ 
  user, 
  username, 
  subscription, 
  onChangePassword 
}: UserProfileContentProps) => {
  return (
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
        <SubscriptionInfo subscription={subscription} />
      </div>
      <div className="pt-4">
        <Button 
          variant="outline" 
          className="w-full"
          onClick={onChangePassword}
        >
          Change Password
        </Button>
      </div>
    </div>
  );
};