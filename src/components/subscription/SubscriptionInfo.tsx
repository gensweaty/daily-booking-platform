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
  
  // Convert all dates to UTC for consistent comparison
  const now = new Date();
  const end = new Date(endDate);
  const start = startDate ? new Date(startDate) : null;

  // Debug logging
  console.log('Subscription Time Calculation:', {
    now: now.toISOString(),
    end: end.toISOString(),
    start: start?.toISOString(),
    isTrialPeriod
  });

  // Subscription hasn't started
  if (start && now < start) {
    const timeToStart = formatDistanceToNow(start, { addSuffix: true });
    return `Subscription starts ${timeToStart}`;
  }

  // Subscription has expired
  if (now > end) {
    return 'Subscription has expired';
  }

  // Active subscription
  const timeLeft = formatDistanceToNow(end, { addSuffix: true });
  return isTrialPeriod 
    ? `Trial period: ${timeLeft}`
    : timeLeft.replace('in ', ''); // Remove 'in ' prefix for cleaner display
};

export const SubscriptionInfo = ({ subscription }: SubscriptionInfoProps) => {
  if (!subscription) return null;

  // Debug logging of full subscription data
  console.log('Full Subscription Data:', JSON.stringify(subscription, null, 2));

  const isTrialPeriod = subscription.status === 'trial';
  const endDate = isTrialPeriod ? subscription.trial_end_date : subscription.current_period_end;
  const startDate = subscription.current_period_start;

  // Debug logging of processed dates
  console.log('Processed Dates:', {
    isTrialPeriod,
    endDate,
    startDate,
    status: subscription.status
  });

  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground">
        {formatPlanType(subscription.plan_type)}
      </p>
      <p className="text-xs text-muted-foreground">
        {formatTimeLeft(endDate, startDate, isTrialPeriod)}
      </p>
      {process.env.NODE_ENV === 'development' && (
        <div className="text-xs text-muted-foreground mt-2 p-2 bg-secondary/50 rounded">
          <p className="font-medium">Debug Info:</p>
          <p>Status: {subscription.status}</p>
          <p>End Date: {endDate}</p>
          <p>Start Date: {startDate}</p>
          <p>Trial End: {subscription.trial_end_date}</p>
        </div>
      )}
    </div>
  );
};