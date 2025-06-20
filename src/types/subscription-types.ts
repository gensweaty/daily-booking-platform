
export interface SubscriptionPlan {
  id: string;
  name: string;
  type: 'monthly' | 'yearly' | 'ultimate';
  price: number;
  description: string | null;
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan_id: string;
  plan_type: 'monthly' | 'yearly' | 'ultimate';
  status: 'trial' | 'trial_expired' | 'active' | 'expired' | 'canceled';
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  trial_end_date: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  subscription_start_date: string | null;
  subscription_end_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionStatus {
  success: boolean;
  status: 'trial' | 'trial_expired' | 'active' | 'expired' | 'canceled' | 'not_authenticated';
  daysRemaining?: number;
  trialEnd?: string;
  currentPeriodEnd?: string;
  planType?: 'monthly' | 'yearly' | 'ultimate';
  isTrialExpired?: boolean;
  isSubscriptionExpired?: boolean;
  subscription_start_date?: string;
  subscription_end_date?: string;
}
