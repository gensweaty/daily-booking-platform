
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { SubscriptionCountdown } from "./SubscriptionCountdown";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "@/components/shared/LanguageText";

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
  const { t } = useLanguage();

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
              <div className="font-semibold">
                <LanguageText>{t('subscription.monthlyPlan')}</LanguageText>
              </div>
              <div className="text-sm text-muted-foreground">
                <LanguageText>
                  {t('subscription.monthlyPrice')} - <span className="line-through text-gray-400">{t('subscription.monthlyOriginalPrice')}</span> <span className="text-green-600 font-medium">{t('subscription.discount50')}</span>
                </LanguageText>
              </div>
              <div className="text-xs text-green-600">
                <LanguageText>{t('subscription.monthlyDuration')}</LanguageText>
              </div>
            </Label>
          </div>
          
          <div className="flex items-start space-x-4 p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900">
            <RadioGroupItem value="yearly" id="yearly" className="mt-1" />
            <Label htmlFor="yearly" className="flex-1 space-y-1 cursor-pointer">
              <div className="font-semibold flex items-center gap-2">
                <LanguageText>{t('subscription.annualPlan')}</LanguageText>
                <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                  <LanguageText>{t('subscription.additionalSavings')}</LanguageText>
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                <LanguageText>
                  {t('subscription.yearlyPrice')} - <span className="line-through text-gray-400">{t('subscription.yearlyOriginalPrice')}</span> <span className="text-green-600 font-medium">{t('subscription.discount50')}</span>
                </LanguageText>
              </div>
              <div className="text-xs text-green-600">
                <LanguageText>{t('subscription.yearlyDuration')}</LanguageText>
              </div>
            </Label>
          </div>
        </RadioGroup>
      </div>
    </div>
  );
};
