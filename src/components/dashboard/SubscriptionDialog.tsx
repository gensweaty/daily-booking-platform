import { AlertDialog, AlertDialogContent } from "@/components/ui/alert-dialog";
import { SubscriptionPlans } from "@/components/landing/SubscriptionPlans";

interface SubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isTrialExpired: boolean;
}

export const SubscriptionDialog = ({ open, onOpenChange, isTrialExpired }: SubscriptionDialogProps) => {
  return (
    <AlertDialog 
      open={open} 
      onOpenChange={(newOpen) => {
        // Only allow closing if trial is not expired
        if (!isTrialExpired) {
          onOpenChange(newOpen);
        }
      }}
    >
      <AlertDialogContent className="max-w-3xl">
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Your Trial Has Expired</h2>
            <p className="text-muted-foreground">
              Please choose a subscription plan to continue using Taskify Minder Note
            </p>
          </div>
          <SubscriptionPlans />
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
};