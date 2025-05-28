
import { supabase } from "@/lib/supabase";

export const simulateTestPayment = async () => {
  try {
    console.log('Simulating test payment for ycd88235@jioso.com...');
    
    const session = await supabase.auth.getSession();
    if (!session.data.session?.access_token) {
      throw new Error('No valid session found');
    }

    const response = await supabase.functions.invoke('test-payment-simulation', {
      headers: {
        Authorization: `Bearer ${session.data.session.access_token}`,
      },
    });

    if (response.error) {
      console.error('Test payment simulation error:', response.error);
      throw new Error(response.error.message || 'Failed to simulate payment');
    }

    console.log('Test payment simulation result:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error calling test payment simulation:', error);
    throw error;
  }
};
