
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { format, parseISO, startOfMonth, endOfMonth, addMonths } from 'date-fns';

interface OptimizedTaskStats {
  total: number;
  completed: number;
  inProgress: number;
  todo: number;
}

interface OptimizedEventStats {
  total: number;
  partlyPaid: number;
  fullyPaid: number;
  totalIncome: number;
  monthlyIncome: Array<{ month: string; income: number }>;
  dailyStats: Array<{ day: string; date: Date; month: string; bookings: number }>;
}

export const useOptimizedStatistics = (userId: string | undefined, dateRange: { start: Date; end: Date }) => {
  // Optimized task stats with single aggregation query
  const { data: taskStats, isLoading: isLoadingTaskStats } = useQuery({
    queryKey: ['optimized-task-stats', userId],
    queryFn: async (): Promise<OptimizedTaskStats> => {
      if (!userId) return { total: 0, completed: 0, inProgress: 0, todo: 0 };
      
      // Single aggregated query instead of fetching all records
      const { data, error } = await supabase
        .rpc('get_task_stats', { user_id_param: userId });

      if (error) {
        console.error('Error fetching task stats:', error);
        // Fallback to simple count query
        const { count } = await supabase
          .from('tasks')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId);
        
        return { total: count || 0, completed: 0, inProgress: 0, todo: 0 };
      }

      return data || { total: 0, completed: 0, inProgress: 0, todo: 0 };
    },
    enabled: !!userId,
    staleTime: 15 * 60 * 1000, // 15 minutes
    gcTime: 30 * 60 * 1000,
  });

  // Optimized event stats with selective fields and aggregation
  const { data: eventStats, isLoading: isLoadingEventStats } = useQuery({
    queryKey: ['optimized-event-stats', userId, dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: async (): Promise<OptimizedEventStats> => {
      if (!userId) return {
        total: 0,
        partlyPaid: 0,
        fullyPaid: 0,
        totalIncome: 0,
        monthlyIncome: [],
        dailyStats: []
      };

      const startDateStr = dateRange.start.toISOString();
      const endDateStr = dateRange.end.toISOString();

      // Single query for all events with minimal fields
      const { data: events, error } = await supabase
        .from('events')
        .select('start_date, payment_status, payment_amount')
        .eq('user_id', userId)
        .gte('start_date', startDateStr)
        .lte('start_date', endDateStr)
        .is('deleted_at', null);

      if (error) {
        console.error('Error fetching event stats:', error);
        throw error;
      }

      // Single query for CRM events
      const { data: crmEvents, error: crmError } = await supabase
        .from('customers')
        .select('start_date, payment_status, payment_amount')
        .eq('user_id', userId)
        .eq('create_event', true)
        .gte('start_date', startDateStr)
        .lte('start_date', endDateStr)
        .is('deleted_at', null);

      if (crmError) {
        console.error('Error fetching CRM events:', crmError);
      }

      // Combine and process data efficiently
      const allEvents = [...(events || []), ...(crmEvents || [])];
      
      let total = allEvents.length;
      let partlyPaid = 0;
      let fullyPaid = 0;
      let totalIncome = 0;

      // Process in single loop for efficiency
      const dailyBookings = new Map<string, number>();
      const monthlyIncomeMap = new Map<string, number>();

      for (const event of allEvents) {
        // Payment status counts
        if (event.payment_status?.includes('partly')) partlyPaid++;
        if (event.payment_status?.includes('fully')) fullyPaid++;

        // Income calculation
        if ((event.payment_status?.includes('partly') || event.payment_status?.includes('fully')) && event.payment_amount) {
          const amount = typeof event.payment_amount === 'number' ? event.payment_amount : parseFloat(event.payment_amount.toString());
          if (!isNaN(amount)) totalIncome += amount;
        }

        // Daily stats
        if (event.start_date) {
          const day = format(parseISO(event.start_date), 'yyyy-MM-dd');
          dailyBookings.set(day, (dailyBookings.get(day) || 0) + 1);

          // Monthly income
          const month = format(parseISO(event.start_date), 'MMM yyyy');
          const amount = typeof event.payment_amount === 'number' ? event.payment_amount : parseFloat(event.payment_amount?.toString() || '0');
          if (!isNaN(amount) && (event.payment_status?.includes('partly') || event.payment_status?.includes('fully'))) {
            monthlyIncomeMap.set(month, (monthlyIncomeMap.get(month) || 0) + amount);
          }
        }
      }

      // Convert maps to arrays
      const dailyStats = Array.from(dailyBookings.entries()).map(([day, bookings]) => ({
        day: format(parseISO(day), 'dd'),
        date: parseISO(day),
        month: format(parseISO(day), 'MMM yyyy'),
        bookings
      }));

      const monthlyIncome = Array.from(monthlyIncomeMap.entries()).map(([month, income]) => ({
        month,
        income
      }));

      return {
        total,
        partlyPaid,
        fullyPaid,
        totalIncome,
        monthlyIncome,
        dailyStats
      };
    },
    enabled: !!userId,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 20 * 60 * 1000,
  });

  return { 
    taskStats, 
    eventStats,
    isLoading: isLoadingTaskStats || isLoadingEventStats
  };
};
