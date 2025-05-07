
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { format, parseISO, eachDayOfInterval, endOfDay, startOfMonth, endOfMonth, differenceInMonths, addMonths, eachMonthOfInterval } from 'date-fns';

export const useStatistics = (userId: string | undefined, dateRange: { start: Date; end: Date }) => {
  // Memoize query keys to prevent unnecessary re-renders
  const taskStatsQueryKey = ['taskStats', userId, dateRange.start.toISOString().split('T')[0], dateRange.end.toISOString().split('T')[0]];
  const eventStatsQueryKey = ['eventStats', userId, dateRange.start.toISOString().split('T')[0], dateRange.end.toISOString().split('T')[0]];

  // Optimize task stats query
  const { data: taskStats, isLoading: isLoadingTaskStats } = useQuery({
    queryKey: taskStatsQueryKey,
    queryFn: async () => {
      if (!userId) return {
        total: 0,
        completed: 0,
        inProgress: 0,
        todo: 0,
      };
      
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select('status')
        .eq('user_id', userId);

      if (error) {
        console.error('Error fetching task stats:', error);
        throw error;
      }

      return {
        total: tasks?.length || 0,
        completed: tasks?.filter(t => t.status === 'done').length || 0,
        inProgress: tasks?.filter(t => t.status === 'inprogress').length || 0,
        todo: tasks?.filter(t => t.status === 'todo').length || 0,
      };
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Optimize events stats query with more efficient date handling and include CRM events
  const { data: eventStats, isLoading: isLoadingEventStats } = useQuery({
    queryKey: eventStatsQueryKey,
    queryFn: async () => {
      if (!userId) return {
        total: 0,
        partlyPaid: 0,
        fullyPaid: 0,
        dailyStats: [],
        monthlyIncome: [],
        totalIncome: 0,
        events: [],
      };
      
      // Format dates for Supabase query
      const startDateStr = dateRange.start.toISOString();
      const endDateStr = endOfDay(dateRange.end).toISOString();
      
      // Get all calendar events
      const { data: calendarEvents, error: calendarError } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', userId)
        .gte('start_date', startDateStr)
        .lte('start_date', endDateStr)
        .is('deleted_at', null);

      if (calendarError) {
        console.error('Error fetching calendar event stats:', calendarError);
        throw calendarError;
      }
      
      // Get all customers with create_event=true (events created from CRM)
      const { data: crmEvents, error: crmError } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', userId)
        .eq('create_event', true)
        .gte('start_date', startDateStr)
        .lte('start_date', endDateStr)
        .is('deleted_at', null);
        
      if (crmError) {
        console.error('Error fetching CRM event stats:', crmError);
        throw crmError;
      }
      
      console.log(`Statistics - Found ${calendarEvents?.length || 0} calendar events and ${crmEvents?.length || 0} CRM events`);
      
      // Normalize payment status values
      const normalizePaymentStatus = (status: string | null | undefined) => {
        if (!status) return 'not_paid';
        if (status.includes('partly')) return 'partly_paid';
        if (status.includes('fully')) return 'fully_paid';
        if (status.includes('not')) return 'not_paid';
        return status;
      };
      
      // Combine all events, ensuring CRM events aren't duplicated
      // Use a Map to prevent duplications by start_date and end_date
      const eventsMap = new Map();
      
      // First add calendar events
      calendarEvents?.forEach(event => {
        const key = `${event.start_date}-${event.end_date}-${event.title}`;
        eventsMap.set(key, {
          ...event,
          payment_status: normalizePaymentStatus(event.payment_status)
        });
      });
      
      // Then add CRM events if they don't already exist
      crmEvents?.forEach(event => {
        const key = `${event.start_date}-${event.end_date}-${event.title}`;
        if (!eventsMap.has(key)) {
          eventsMap.set(key, {
            id: event.id,
            title: event.title,
            user_surname: event.user_surname || event.title,
            start_date: event.start_date,
            end_date: event.end_date,
            payment_status: normalizePaymentStatus(event.payment_status),
            payment_amount: event.payment_amount,
            type: event.type || 'event',
            created_at: event.created_at,
            user_id: event.user_id,
            // Other fields can be null or defaults
          });
        }
      });
      
      // Convert Map back to array
      const allEvents = Array.from(eventsMap.values());
      console.log(`Statistics - Combined into ${allEvents.length} total unique events`);

      // Get payment status counts using normalized values
      const partlyPaid = allEvents.filter(e => 
        normalizePaymentStatus(e.payment_status) === 'partly_paid'
      ).length || 0;
      
      const fullyPaid = allEvents.filter(e => 
        normalizePaymentStatus(e.payment_status) === 'fully_paid'
      ).length || 0;

      // Get all days in the selected range for daily bookings
      const daysInRange = eachDayOfInterval({
        start: dateRange.start,
        end: dateRange.end
      });

      const dailyBookings = daysInRange.map(day => {
        const dayEvents = allEvents.filter(event => {
          if (!event.start_date) return false;
          const eventDate = parseISO(event.start_date);
          return format(eventDate, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd');
        });

        return {
          day: format(day, 'dd'),
          date: day,
          month: format(day, 'MMM yyyy'),
          bookings: dayEvents?.length || 0,
        };
      });

      // Optimize monthly income calculations
      let monthsToCompare;
      const currentDate = new Date();
      const isDefaultDateRange = 
        format(dateRange.start, 'yyyy-MM-dd') === format(startOfMonth(currentDate), 'yyyy-MM-dd') &&
        format(dateRange.end, 'yyyy-MM-dd') === format(endOfMonth(currentDate), 'yyyy-MM-dd');

      if (isDefaultDateRange) {
        // For default view, show current month and previous 2 months
        monthsToCompare = [
          addMonths(startOfMonth(currentDate), -2),
          addMonths(startOfMonth(currentDate), -1),
          startOfMonth(currentDate)
        ];
      } else {
        // For manually selected date range, use those months
        monthsToCompare = eachMonthOfInterval({
          start: startOfMonth(dateRange.start),
          end: endOfMonth(dateRange.end)
        });
      }

      // Fetch monthly data directly from all events we've already collected
      const monthlyIncome = monthsToCompare.map(month => {
        const monthStart = startOfMonth(month);
        const monthEnd = endOfDay(endOfMonth(month));
        
        // Filter events within this month
        const monthEvents = allEvents.filter(event => {
          if (!event.start_date) return false;
          const eventDate = parseISO(event.start_date);
          return eventDate >= monthStart && eventDate <= monthEnd;
        });
        
        // Calculate income from events with valid payment status
        const income = monthEvents.reduce((acc, event) => {
          const status = normalizePaymentStatus(event.payment_status);
          const isPaid = status === 'fully_paid' || status === 'partly_paid';
                           
          if (isPaid && event.payment_amount) {
            return acc + Number(event.payment_amount);
          }
          return acc;
        }, 0);
        
        return {
          month: format(month, 'MMM yyyy'),
          income: income || 0,
        };
      });

      // Calculate total income correctly using normalized payment statuses
      const totalIncome = allEvents.reduce((acc, event) => {
        const status = normalizePaymentStatus(event.payment_status);
        const isPaid = status === 'fully_paid' || status === 'partly_paid';
                       
        if (isPaid && event.payment_amount) {
          // Ensure payment_amount is processed as a number
          const amount = typeof event.payment_amount === 'string' 
            ? parseFloat(event.payment_amount) 
            : Number(event.payment_amount);
            
          // Debug to find any NaN values
          if (isNaN(amount)) {
            console.warn('Invalid payment amount detected:', event.payment_amount, 'for event:', event.id);
            return acc;
          }
          
          return acc + amount;
        }
        return acc;
      }, 0);
      
      // Log income calculation for debugging
      console.log('Total income calculated:', totalIncome, 'from', allEvents.length, 'events');
      console.log('Payment statuses distribution:', {
        fullyPaid,
        partlyPaid,
        notPaid: allEvents.length - fullyPaid - partlyPaid
      });

      return {
        total: allEvents.length || 0,
        partlyPaid,
        fullyPaid,
        dailyStats: dailyBookings,
        monthlyIncome,
        totalIncome,
        events: allEvents || [],
      };
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return { 
    taskStats, 
    eventStats,
    isLoading: isLoadingTaskStats || isLoadingEventStats
  };
};
