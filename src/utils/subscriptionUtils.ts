import { supabase } from "@/lib/supabase";

export const checkExistingSubscription = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .single();

  return {
    isSubscribed: subscription && 
      user.email === 'anania.devsurashvili885@law.tsu.edu.ge' && 
      subscription.status === 'active',
    subscription
  };
};