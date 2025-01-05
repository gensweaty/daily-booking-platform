import { PayPalButtonConfig } from '@/types/paypal-types';

export const PAYPAL_BUTTON_CONFIGS: Record<string, PayPalButtonConfig> = {
  monthly: {
    planType: 'monthly',
    hostedButtonId: 'ST9DUFXHJCGWJ'
  },
  yearly: {
    planType: 'yearly',
    hostedButtonId: 'YDK5G6VR2EA8L'
  },
  test: {
    planType: 'test',
    hostedButtonId: '' // You'll need to add the hosted button ID from PayPal here
  }
};

export const PAYPAL_SDK_OPTIONS = {
  'client-id': 'BAAlwpFrqvuXEZGXZH7jc6dlt2dJ109CJK2FBo79HD8OaKcGL5Qr8FQilvteW7BkjgYo9Jah5aXcRICk3Q',
  'components': 'hosted-buttons',
  'disable-funding': 'venmo',
  'currency': 'USD',
  'return': 'http://localhost:5173/dashboard?subscription=success' // Local development return URL
};

// For production, you should use your deployed URL:
// 'return': 'https://your-domain.com/dashboard?subscription=success'