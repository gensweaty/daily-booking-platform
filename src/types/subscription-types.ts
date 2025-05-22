
export interface SubscriptionPlan {
  id: string;
  name: string;
  type: 'monthly' | 'yearly';
  price: number;
  description: string | null;
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan_id: string;
  plan_type: 'monthly' | 'yearly';
  status: 'trial' | 'trial_expired' | 'active' | 'expired' | 'canceled';
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  trial_end_date: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionStatus {
  success: boolean;
  status: 'trial' | 'trial_expired' | 'active' | 'expired' | 'canceled' | 'not_authenticated';
  daysRemaining?: number;
  trialEnd?: string;
  currentPeriodEnd?: string;
  planType?: 'monthly' | 'yearly';
  isTrialExpired?: boolean;
  isSubscriptionExpired?: boolean;
}
