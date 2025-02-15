
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface SubscriptionPlanSelectProps {
  selectedPlan: 'monthly' | 'yearly';
  setSelectedPlan: (plan: 'monthly' | 'yearly') => void;
  isLoading: boolean;
}

export const SubscriptionPlanSelect = ({ 
  selectedPlan, 
  setSelectedPlan, 
  isLoading 
}: SubscriptionPlanSelectProps) => {
  return (
    <div className="space-y-4">
      <RadioGroup
        value={selectedPlan}
        onValueChange={(value: 'monthly' | 'yearly') => setSelectedPlan(value)}
        disabled={isLoading}
      >
        <div className="flex items-start space-x-4">
          <RadioGroupItem value="monthly" id="monthly" className="mt-1" />
          <Label htmlFor="monthly" className="flex-1 space-y-1">
            <div className="font-semibold">Monthly Plan</div>
            <div className="text-sm text-muted-foreground">
              $9.99/month
            </div>
          </Label>
        </div>
        <div className="flex items-start space-x-4">
          <RadioGroupItem value="yearly" id="yearly" className="mt-1" />
          <Label htmlFor="yearly" className="flex-1 space-y-1">
            <div className="font-semibold">Annual Plan</div>
            <div className="text-sm text-muted-foreground">
              $99.99/year (Save 17%)
            </div>
          </Label>
        </div>
      </RadioGroup>
    </div>
  );
};
