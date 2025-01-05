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
    hostedButtonId: 'SZHF9WLR5RQWU'
  }
};

export const PAYPAL_SDK_OPTIONS = {
  'client-id': 'ATm58Iv3bVdLcUIVllc-on6VZRaRJeedpxso0KgGVu_kSELKrKOqaE63a8CNu-jIQ4ulE2j9WUkLASlY',
  'components': 'hosted-buttons',
  'disable-funding': 'venmo',
  'currency': 'USD',
  'return': window.location.origin + '/dashboard?subscription=success'
};