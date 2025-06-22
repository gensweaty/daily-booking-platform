
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

  // Simplified and faster event stats query with improved multi-person income calculation
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

      // Use Promise.all to make queries concurrent for better performance
      const [eventsResult, crmEventsResult, customersResult] = await Promise.all([
        supabase
          .from('events')
          .select('start_date, end_date, payment_status, payment_amount, title, id, user_surname, social_network_link')
          .eq('user_id', userId)
          .gte('start_date', startDateStr)
          .lte('start_date', endDateStr)
          .is('deleted_at', null),
        
        supabase
          .from('customers')
          .select('start_date, end_date, payment_status, payment_amount, title, id, user_surname, social_network_link, type')
          .eq('user_id', userId)
          .eq('create_event', true)
          .gte('start_date', startDateStr)
          .lte('start_date', endDateStr)
          .is('deleted_at', null),

        // Get all customers to find additional persons for events
        supabase
          .from('customers')
          .select('start_date, end_date, payment_status, payment_amount, title, id, user_surname, social_network_link, type')
          .eq('user_id', userId)
          .eq('type', 'customer')
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

      if (customersResult.error) {
        console.error('Error fetching customers:', customersResult.error);
      }

      // Group events by their date/time to identify multi-person events
      const eventGroups = new Map<string, any[]>();
      
      // Process main events
      const allMainEvents = [
        ...(eventsResult.data || []), 
        ...(crmEventsResult.data || [])
      ];

      // Group events by start_date and end_date
      allMainEvents.forEach(event => {
        const key = `${event.start_date}-${event.end_date}`;
        if (!eventGroups.has(key)) {
          eventGroups.set(key, []);
        }
        eventGroups.get(key)?.push({ ...event, source: 'main_event' });
      });

      // Add customers to their corresponding event groups
      (customersResult.data || []).forEach(customer => {
        const key = `${customer.start_date}-${customer.end_date}`;
        if (eventGroups.has(key)) {
          eventGroups.get(key)?.push({ ...customer, source: 'additional_person' });
        }
      });

      console.log(`Found ${eventGroups.size} unique event groups`);

      // Process all stats in a single optimized loop
      let total = eventGroups.size; // Count unique events, not individual persons
      let partlyPaid = 0;
      let fullyPaid = 0;
      let totalIncome = 0;

      const dailyBookings = new Map<string, number>();
      const monthlyIncomeMap = new Map<string, number>();
      const processedEvents: any[] = [];

      for (const [timeKey, eventGroup] of eventGroups) {
        // Calculate combined payment status and income for this event group
        let groupIncome = 0;
        let hasPartlyPaid = false;
        let hasFullyPaid = false;
        let hasAnyPayment = false;

        // Find the main event (first non-customer entry) for display purposes
        const mainEvent = eventGroup.find(e => e.source === 'main_event') || eventGroup[0];

        // Sum up all payments from all persons in this event group
        eventGroup.forEach(person => {
          const paymentStatus = person.payment_status || '';
          
          if (paymentStatus.includes('partly')) {
            hasPartlyPaid = true;
            hasAnyPayment = true;
          }
          if (paymentStatus.includes('fully')) {
            hasFullyPaid = true;
            hasAnyPayment = true;
          }

          // Income calculation - sum from all persons in the event
          if ((paymentStatus.includes('partly') || paymentStatus.includes('fully')) && person.payment_amount) {
            const amount = typeof person.payment_amount === 'number' 
              ? person.payment_amount 
              : parseFloat(String(person.payment_amount));
            if (!isNaN(amount) && amount > 0) {
              groupIncome += amount;
              console.log(`Adding ${amount} from person ${person.id} in event group ${timeKey}`);
            }
          }
        });

        // Count payment status for the event (not per person)
        if (hasPartlyPaid && !hasFullyPaid) partlyPaid++;
        if (hasFullyPaid) fullyPaid++;

        // Add group income to total
        totalIncome += groupIncome;

        // Daily and monthly stats (count as one event, not per person)
        if (mainEvent.start_date) {
          try {
            const eventDate = parseISO(mainEvent.start_date);
            const day = format(eventDate, 'yyyy-MM-dd');
            dailyBookings.set(day, (dailyBookings.get(day) || 0) + 1);

            // Monthly income aggregation (use group income)
            if (hasAnyPayment && groupIncome > 0) {
              const month = format(eventDate, 'MMM yyyy');
              monthlyIncomeMap.set(month, (monthlyIncomeMap.get(month) || 0) + groupIncome);
            }
          } catch (dateError) {
            console.warn('Invalid date in event:', mainEvent.start_date);
          }
        }

        // Create a combined event entry for export compatibility
        processedEvents.push({
          ...mainEvent,
          combined_payment_amount: groupIncome,
          person_count: eventGroup.length,
          all_persons: eventGroup
        });
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
        events: processedEvents // Include processed events for export compatibility
      };

      console.log('Event stats result with multi-person income calculation:', {
        total: result.total,
        partlyPaid: result.partlyPaid,
        fullyPaid: result.fullyPaid,
        totalIncome: result.totalIncome,
        eventGroups: eventGroups.size
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
