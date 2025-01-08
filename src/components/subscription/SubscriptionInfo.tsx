import { formatDistanceToNow, addMonths, addYears, isAfter } from "date-fns";

interface Subscription {
  plan_type: string;
  status: string;
  current_period_end: string | null;
  current_period_start: string | null;
  trial_end_date: string | null;
}

interface SubscriptionInfoProps {
  subscription: Subscription | null;
}

const formatPlanType = (planType: string) => {
  return planType === 'monthly' ? 'Monthly Plan' : 'Yearly Plan';
};

const formatTimeLeft = (endDate: string | null, startDate: string | null, isTrialPeriod: boolean = false) => {
  if (!endDate || !startDate) return '';
  
  const end = new Date(endDate);
  const start = new Date(startDate);
  const now = new Date();

  // Calculate subscription length based on plan type
  const subscriptionLength = isAfter(end, start) 
    ? formatDistanceToNow(end, { addSuffix: true })
    : 'Subscription ended';

  if (isTrialPeriod) {
    return `Trial ${subscriptionLength}`;
  }
  
  return `Subscription expires ${subscriptionLength}`;
};

export const SubscriptionInfo = ({ subscription }: SubscriptionInfoProps) => {
  if (!subscription) return null;

  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground">
        {formatPlanType(subscription.plan_type)}
      </p>
      <p className="text-xs text-muted-foreground">
        {subscription.status === 'trial' 
          ? formatTimeLeft(subscription.trial_end_date, subscription.current_period_start, true)
          : formatTimeLeft(subscription.current_period_end, subscription.current_period_start)}
      </p>
    </div>
  );
};