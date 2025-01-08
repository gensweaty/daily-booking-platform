import { formatDistanceToNow } from "date-fns";

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

const formatTimeLeft = (
  endDate: string | null, 
  startDate: string | null, 
  isTrialPeriod: boolean = false
) => {
  if (!endDate) return 'No subscription end date';
  
  const now = new Date();
  const end = new Date(endDate);
  const start = startDate ? new Date(startDate) : null;

  // Log dates for debugging
  console.log('Current time:', now);
  console.log('End date:', end);
  console.log('Start date:', start);

  // If the subscription has ended
  if (now > end) {
    return 'Subscription has expired';
  }

  // If subscription hasn't started yet
  if (start && now < start) {
    const timeToStart = formatDistanceToNow(start);
    return `Subscription starts in ${timeToStart}`;
  }

  // Calculate time remaining
  const timeLeft = formatDistanceToNow(end);
  
  if (isTrialPeriod) {
    return `Trial period: ${timeLeft} remaining`;
  }
  
  return `${timeLeft} remaining`;
};

export const SubscriptionInfo = ({ subscription }: SubscriptionInfoProps) => {
  if (!subscription) return null;

  console.log('Subscription data:', subscription);

  const isTrialPeriod = subscription.status === 'trial';
  const endDate = isTrialPeriod ? subscription.trial_end_date : subscription.current_period_end;
  const startDate = subscription.current_period_start;

  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground">
        {formatPlanType(subscription.plan_type)}
      </p>
      <p className="text-xs text-muted-foreground">
        {formatTimeLeft(endDate, startDate, isTrialPeriod)}
      </p>
    </div>
  );
};