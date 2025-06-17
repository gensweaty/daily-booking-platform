
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
  // Add events property for compatibility with export function
  events: Array<any>;
}

export const useOptimizedStatistics = (userId: string | undefined, dateRange: { start: Date; end: Date }) => {
  // Optimized task stats with better error handling and direct query fallback
  const { data: taskStats, isLoading: isLoadingTaskStats } = useQuery({
    queryKey: ['task-stats', userId],
    queryFn: async (): Promise<OptimizedTaskStats> => {
      if (!userId) return { total: 0, completed: 0, inProgress: 0, todo: 0 };
      
      console.log('Fetching task stats for user:', userId);
      
      try {
        // Try the RPC function first
        const { data: rpcData, error: rpcError } = await supabase
          .rpc('get_task_stats', { user_id_param: userId });

        if (!rpcError && rpcData && rpcData.length > 0) {
          console.log('RPC task stats success:', rpcData[0]);
          const stats = rpcData[0];
          return {
            total: Number(stats.total) || 0,
            completed: Number(stats.completed) || 0,
            inProgress: Number(stats.in_progress) || 0,
            todo: Number(stats.todo) || 0
          };
        }
        
        console.log('RPC failed, using fallback query. RPC Error:', rpcError);
      } catch (error) {
        console.log('RPC function failed, using direct query fallback:', error);
      }

      // Fallback to direct aggregation query
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select('status')
        .eq('user_id', userId);

      if (error) {
        console.error('Error fetching tasks:', error);
        return { total: 0, completed: 0, inProgress: 0, todo: 0 };
      }

      const stats = {
        total: tasks?.length || 0,
        completed: tasks?.filter(t => t.status === 'done').length || 0,
        inProgress: tasks?.filter(t => t.status === 'inprogress').length || 0,
        todo: tasks?.filter(t => t.status === 'todo').length || 0
      };

      console.log('Direct query task stats:', stats);
      return stats;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes - reduced from 15 for fresher data
    gcTime: 10 * 60 * 1000, // 10 minutes - reduced from 30
  });

  // Simplified and faster event stats query
  const { data: eventStats, isLoading: isLoadingEventStats } = useQuery({
    queryKey: ['event-stats', userId, dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: async (): Promise<OptimizedEventStats> => {
      if (!userId) return {
        total: 0,
        partlyPaid: 0,
        fullyPaid: 0,
        totalIncome: 0,
        monthlyIncome: [],
        dailyStats: [],
        events: []
      };

      console.log('Fetching event stats for user:', userId, 'date range:', dateRange);

      const startDateStr = dateRange.start.toISOString();
      const endDateStr = dateRange.end.toISOString();

      // Use Promise.all to make queries concurrent for better performance
      const [eventsResult, crmEventsResult] = await Promise.all([
        supabase
          .from('events')
          .select('start_date, payment_status, payment_amount, title, id')
          .eq('user_id', userId)
          .gte('start_date', startDateStr)
          .lte('start_date', endDateStr)
          .is('deleted_at', null),
        
        supabase
          .from('customers')
          .select('start_date, payment_status, payment_amount, title, id')
          .eq('user_id', userId)
          .eq('create_event', true)
          .gte('start_date', startDateStr)
          .lte('start_date', endDateStr)
          .is('deleted_at', null)
      ]);

      if (eventsResult.error) {
        console.error('Error fetching events:', eventsResult.error);
      }

      if (crmEventsResult.error) {
        console.error('Error fetching CRM events:', crmEventsResult.error);
      }

      // Combine events efficiently
      const allEvents = [
        ...(eventsResult.data || []), 
        ...(crmEventsResult.data || [])
      ];
      
      console.log('Combined events count:', allEvents.length);

      // Process all stats in a single optimized loop
      let total = allEvents.length;
      let partlyPaid = 0;
      let fullyPaid = 0;
      let totalIncome = 0;

      const dailyBookings = new Map<string, number>();
      const monthlyIncomeMap = new Map<string, number>();

      for (const event of allEvents) {
        // Payment status counts
        const paymentStatus = event.payment_status || '';
        if (paymentStatus.includes('partly')) partlyPaid++;
        if (paymentStatus.includes('fully')) fullyPaid++;

        // Income calculation - more robust parsing
        if ((paymentStatus.includes('partly') || paymentStatus.includes('fully')) && event.payment_amount) {
          const amount = typeof event.payment_amount === 'number' 
            ? event.payment_amount 
            : parseFloat(String(event.payment_amount));
          if (!isNaN(amount) && amount > 0) {
            totalIncome += amount;
          }
        }

        // Daily and monthly stats
        if (event.start_date) {
          try {
            const eventDate = parseISO(event.start_date);
            const day = format(eventDate, 'yyyy-MM-dd');
            dailyBookings.set(day, (dailyBookings.get(day) || 0) + 1);

            // Monthly income aggregation
            if ((paymentStatus.includes('partly') || paymentStatus.includes('fully')) && event.payment_amount) {
              const month = format(eventDate, 'MMM yyyy');
              const amount = typeof event.payment_amount === 'number' 
                ? event.payment_amount 
                : parseFloat(String(event.payment_amount));
              if (!isNaN(amount) && amount > 0) {
                monthlyIncomeMap.set(month, (monthlyIncomeMap.get(month) || 0) + amount);
              }
            }
          } catch (dateError) {
            console.warn('Invalid date in event:', event.start_date);
          }
        }
      }

      // Convert maps to arrays efficiently
      const dailyStats = Array.from(dailyBookings.entries()).map(([day, bookings]) => {
        const date = parseISO(day);
        return {
          day: format(date, 'dd'),
          date,
          month: format(date, 'MMM yyyy'),
          bookings
        };
      });

      const monthlyIncome = Array.from(monthlyIncomeMap.entries()).map(([month, income]) => ({
        month,
        income
      }));

      const result = {
        total,
        partlyPaid,
        fullyPaid,
        totalIncome,
        monthlyIncome,
        dailyStats,
        events: allEvents // Include events for export compatibility
      };

      console.log('Event stats result:', {
        total: result.total,
        partlyPaid: result.partlyPaid,
        fullyPaid: result.fullyPaid,
        totalIncome: result.totalIncome
      });

      return result;
    },
    enabled: !!userId,
    staleTime: 3 * 60 * 1000, // 3 minutes - reduced from 10 for fresher data
    gcTime: 15 * 60 * 1000, // 15 minutes - reduced from 20
  });

  return { 
    taskStats, 
    eventStats,
    isLoading: isLoadingTaskStats || isLoadingEventStats
  };
};
