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
  status: 'trial' | 'active' | 'expired';
  trial_end_date: string;
  current_period_start: string;
  current_period_end: string;
  created_at: string;
  updated_at: string;
}