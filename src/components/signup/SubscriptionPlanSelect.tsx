import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

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
    <div className="space-y-2">
      <Label>Subscription Plan</Label>
      <RadioGroup
        value={selectedPlan}
        onValueChange={(value: 'monthly' | 'yearly') => setSelectedPlan(value)}
        className="grid grid-cols-1 gap-4 mt-2"
      >
        <div className="flex items-center space-x-2 border rounded-lg p-4">
          <RadioGroupItem value="monthly" id="monthly" disabled={isLoading} />
          <Label htmlFor="monthly" className="flex-1">
            <div className="flex justify-between items-center">
              <span>Monthly Plan</span>
              <span className="font-semibold">$9.95/month</span>
            </div>
          </Label>
        </div>
        <div className="flex items-center space-x-2 border rounded-lg p-4">
          <RadioGroupItem value="yearly" id="yearly" disabled={isLoading} />
          <Label htmlFor="yearly" className="flex-1">
            <div className="flex justify-between items-center">
              <span>Yearly Plan</span>
              <span className="font-semibold">$89.95/year</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Save over 24% compared to monthly</p>
          </Label>
        </div>
      </RadioGroup>
    </div>
  );
};