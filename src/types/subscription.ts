export interface SubscriptionPlan {
  id: string;
  name: string;
  type: 'monthly' | 'yearly';
  price: number;
  description: string | null;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan_id: string;
  plan_type: string;
  status: 'trial' | 'active' | 'expired';
  trial_end_date: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  subscription_plans?: SubscriptionPlan;
}