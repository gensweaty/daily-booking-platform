export type PayPalPlanType = 'monthly' | 'yearly' | 'test';

export interface PayPalButtonConfig {
  planType: PayPalPlanType;
  hostedButtonId: string;
}

export interface PayPalSubscriptionData {
  orderId: string;
  subscriptionId?: string;
}