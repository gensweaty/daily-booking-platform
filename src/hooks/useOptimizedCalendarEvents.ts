import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

interface OptimizedEvent {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  user_surname?: string;
  payment_status?: string;
  payment_amount?: number;
  type?: string;
  reminder_at?: string;
}

export const useOptimizedCalendarEvents = () => {
  const { user } = useAuth();

  // Fetch events with optimized query
  const { data: eventsData = [], error, isLoading, refetch } = useQuery({
    queryKey: ['optimized-events', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('events')
        .select(`
          id,
          title,
          start_date,
          end_date,
          user_surname,
          payment_status,
          payment_amount,
          type,
          reminder_at
        `)
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('start_date', { ascending: true });

      if (error) {
        console.error('Error fetching optimized events:', error);
        throw error;
      }

      return (data || []) as OptimizedEvent[];
    },
    enabled: !!user?.id,
    staleTime: 30000, // 30 seconds
    cacheTime: 300000, // 5 minutes
  });

  return {
    eventsData,
    error,
    isLoading,
    refetch,
  };
};
