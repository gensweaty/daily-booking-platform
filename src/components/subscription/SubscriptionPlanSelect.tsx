
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { SubscriptionCountdown } from "./SubscriptionCountdown";

interface SubscriptionPlanSelectProps {
  selectedPlan: 'monthly' | 'yearly';
  setSelectedPlan: (plan: 'monthly' | 'yearly') => void;
  isLoading: boolean;
  currentStatus?: {
    status: 'trial' | 'trial_expired' | 'active' | 'expired' | 'canceled';
    currentPeriodEnd?: string;
    trialEnd?: string;
    planType?: 'monthly' | 'yearly';
  };
}

export const SubscriptionPlanSelect = ({ 
  selectedPlan, 
  setSelectedPlan, 
  isLoading,
  currentStatus
}: SubscriptionPlanSelectProps) => {
  return (
    <div className="space-y-6">
      {currentStatus && (
        <SubscriptionCountdown
          status={currentStatus.status}
          currentPeriodEnd={currentStatus.currentPeriodEnd}
          trialEnd={currentStatus.trialEnd}
          planType={currentStatus.planType}
        />
      )}
      
      <div className="space-y-4">
        <RadioGroup
          value={selectedPlan}
          onValueChange={(value: 'monthly' | 'yearly') => setSelectedPlan(value)}
          disabled={isLoading}
        >
          <div className="flex items-start space-x-4 p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900">
            <RadioGroupItem value="monthly" id="monthly" className="mt-1" />
            <Label htmlFor="monthly" className="flex-1 space-y-1 cursor-pointer">
              <div className="font-semibold">Monthly Plan</div>
              <div className="text-sm text-muted-foreground">
                $19.99/month - <span className="line-through text-gray-400">$39.99</span> <span className="text-green-600 font-medium">50% OFF</span>
              </div>
              <div className="text-xs text-green-600">
                30 days of premium access
              </div>
            </Label>
          </div>
          
          <div className="flex items-start space-x-4 p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900">
            <RadioGroupItem value="yearly" id="yearly" className="mt-1" />
            <Label htmlFor="yearly" className="flex-1 space-y-1 cursor-pointer">
              <div className="font-semibold flex items-center gap-2">
                Annual Plan 
                <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                  Save 50%
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                $199.99/year - <span className="line-through text-gray-400">$399.99</span> <span className="text-green-600 font-medium">50% OFF</span>
              </div>
              <div className="text-xs text-green-600">
                365 days of premium access
              </div>
            </Label>
          </div>
        </RadioGroup>
      </div>
    </div>
  );
};
