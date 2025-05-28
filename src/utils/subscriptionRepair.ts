
import { supabase } from "@/lib/supabase";

export const repairSubscription = async () => {
  try {
    console.log('Invoking repair-subscriptions function...');
    
    const session = await supabase.auth.getSession();
    if (!session.data.session?.access_token) {
      throw new Error('No valid session found');
    }

    const response = await supabase.functions.invoke('repair-subscriptions', {
      headers: {
        Authorization: `Bearer ${session.data.session.access_token}`,
      },
    });

    if (response.error) {
      console.error('Repair function error:', response.error);
      throw new Error(response.error.message || 'Failed to repair subscription');
    }

    return response.data;
  } catch (error) {
    console.error('Error calling repair function:', error);
    throw error;
  }
};
