
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
  events: Array<any>;
}

export const useOptimizedStatistics = (userId: string | undefined, dateRange: { start: Date; end: Date }) => {
  // Optimized task stats with better error handling and direct query fallback
  const { data: taskStats, isLoading: isLoadingTaskStats } = useQuery({
    queryKey: ['optimized-task-stats', userId],
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

  // Fixed event stats query with proper payment counting for recurring events
  const { data: eventStats, isLoading: isLoadingEventStats } = useQuery({
    queryKey: ['optimized-event-stats', userId, dateRange.start.toISOString(), dateRange.end.toISOString()],
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

      // Get all events (both parent and instances) in the date range
      const { data: allEvents, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', userId)
        .gte('start_date', startDateStr)
        .lte('start_date', endDateStr)
        .is('deleted_at', null);

      if (eventsError) {
        console.error('Error fetching events:', eventsError);
        return {
          total: 0,
          partlyPaid: 0,
          fullyPaid: 0,
          totalIncome: 0,
          monthlyIncome: [],
          dailyStats: [],
          events: []
        };
      }

      // FIX BUG 2: Get additional persons only for parent events (not child instances)
      // This prevents payment double counting
      const parentEventIds = allEvents
        ?.filter(event => !event.parent_event_id) // Only parent events
        .map(event => event.id) || [];

      let additionalPersons: any[] = [];
      if (parentEventIds.length > 0) {
        const { data: customers, error: customersError } = await supabase
          .from('customers')
          .select('*')
          .in('event_id', parentEventIds)
          .eq('type', 'customer')
          .is('deleted_at', null);

        if (!customersError && customers) {
          additionalPersons = customers;
        }
      }

      // Count unique events (all events in date range)
      const totalEvents = allEvents?.length || 0;

      let partlyPaid = 0;
      let fullyPaid = 0;
      let totalIncome = 0;

      const dailyBookings = new Map<string, number>();
      const monthlyIncomeMap = new Map<string, number>();

      // FIX BUG 2: Create a map to track which parent events we've already processed for payment
      const processedParentEvents = new Set<string>();

      // Process each event individually
      allEvents?.forEach(event => {
        // Count payment status per event
        const paymentStatus = event.payment_status || '';
        
        if (paymentStatus.includes('partly')) {
          partlyPaid++;
        }
        if (paymentStatus.includes('fully')) {
          fullyPaid++;
        }

        // FIX BUG 2: Calculate income only once per parent event (not per recurring instance)
        let eventIncome = 0;
        const eventIdForPayment = event.parent_event_id || event.id; // Use parent ID if child, otherwise use own ID
        
        // Only process payment if we haven't already processed this parent event
        if (!processedParentEvents.has(eventIdForPayment)) {
          processedParentEvents.add(eventIdForPayment);
          
          // Add main person income (only from parent event or standalone event)
          const eventToProcessForPayment = event.parent_event_id 
            ? allEvents?.find(e => e.id === event.parent_event_id) || event
            : event;
            
          if ((eventToProcessForPayment.payment_status?.includes('partly') || 
               eventToProcessForPayment.payment_status?.includes('fully')) && 
              eventToProcessForPayment.payment_amount) {
            const amount = typeof eventToProcessForPayment.payment_amount === 'number' 
              ? eventToProcessForPayment.payment_amount 
              : parseFloat(String(eventToProcessForPayment.payment_amount));
            if (!isNaN(amount) && amount > 0) {
              eventIncome += amount;
            }
          }

          // Add additional persons income (only for parent events)
          if (!event.parent_event_id) {
            const eventAdditionalPersons = additionalPersons.filter(person => person.event_id === event.id);
            eventAdditionalPersons.forEach(person => {
              const personPaymentStatus = person.payment_status || '';
              if ((personPaymentStatus.includes('partly') || personPaymentStatus.includes('fully')) && person.payment_amount) {
                const amount = typeof person.payment_amount === 'number' 
                  ? person.payment_amount 
                  : parseFloat(String(person.payment_amount));
                if (!isNaN(amount) && amount > 0) {
                  eventIncome += amount;
                }
              }
            });
          }
        }

        totalIncome += eventIncome;

        // Daily stats (count each event individually)
        if (event.start_date) {
          try {
            const eventDate = parseISO(event.start_date);
            const day = format(eventDate, 'yyyy-MM-dd');
            dailyBookings.set(day, (dailyBookings.get(day) || 0) + 1);

            // Monthly income aggregation (only add income if we processed payment for this event)
            if (eventIncome > 0) {
              const month = format(eventDate, 'MMM yyyy');
              monthlyIncomeMap.set(month, (monthlyIncomeMap.get(month) || 0) + eventIncome);
            }
          } catch (dateError) {
            console.warn('Invalid date in event:', event.start_date);
          }
        }
      });

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
        total: totalEvents,
        partlyPaid,
        fullyPaid,
        totalIncome,
        monthlyIncome,
        dailyStats,
        events: allEvents || []
      };

      console.log('🔧 Fixed event stats result (Bug 2 - No payment double counting):', {
        total: result.total,
        partlyPaid: result.partlyPaid,
        fullyPaid: result.fullyPaid,
        totalIncome: result.totalIncome,
        additionalPersonsCount: additionalPersons.length,
        processedParentEventsCount: processedParentEvents.size
      });

      return result;
    },
    enabled: !!userId,
    staleTime: 3 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  return { 
    taskStats, 
    eventStats,
    isLoading: isLoadingTaskStats || isLoadingEventStats
  };
};
