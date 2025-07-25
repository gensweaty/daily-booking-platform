
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

interface OptimizedCustomerStats {
  total: number;
  withBooking: number;
  withoutBooking: number;
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

  // Fixed event stats query to properly filter by date range and count correctly
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

      // Get regular events from events table (filter by date range)
      const { data: regularEvents, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', userId)
        .gte('start_date', startDateStr)
        .lte('start_date', endDateStr)
        .is('deleted_at', null);

      if (eventsError) {
        console.error('Error fetching regular events:', eventsError);
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

      // Get approved booking requests from booking_requests table (filter by date range)
      const { data: bookingRequests, error: bookingError } = await supabase
        .from('booking_requests')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'approved')
        .gte('start_date', startDateStr)
        .lte('start_date', endDateStr)
        .is('deleted_at', null);

      if (bookingError) {
        console.error('Error fetching booking requests:', bookingError);
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

      // Transform booking requests to match event structure
      const transformedBookingRequests = (bookingRequests || []).map(booking => ({
        ...booking,
        type: 'booking_request',
        title: booking.title,
        user_surname: booking.requester_name,
        user_number: booking.requester_phone,
        social_network_link: booking.requester_email,
        event_notes: booking.description
      }));

      // Combine both types of events
      const allEvents = [
        ...(regularEvents || []),
        ...transformedBookingRequests
      ];

      console.log(`Found ${regularEvents?.length || 0} regular events and ${bookingRequests?.length || 0} approved booking requests in date range`);

      // Get additional persons only for parent events (not child instances) that are in the date range
      const parentEventIds = regularEvents
        ?.filter(event => !event.parent_event_id) // Only parent events
        .map(event => event.id) || [];

      let additionalPersons: any[] = [];
      if (parentEventIds.length > 0) {
        const { data: customers, error: customersError } = await supabase
          .from('customers')
          .select('*')
          .in('event_id', parentEventIds)
          .eq('type', 'customer')
          .gte('start_date', startDateStr)
          .lte('start_date', endDateStr)
          .is('deleted_at', null);

        if (!customersError && customers) {
          additionalPersons = customers;
        }
      }

      // Count unique events in the selected date range
      const totalEvents = allEvents.length;

      let partlyPaid = 0;
      let fullyPaid = 0;
      let totalIncome = 0;

      const dailyBookings = new Map<string, number>();
      const monthlyIncomeMap = new Map<string, number>();

      // Process events for payment status and income calculation
      allEvents.forEach(event => {
        // Count payment status per event
        const paymentStatus = event.payment_status || '';
        
        if (paymentStatus.includes('partly')) {
          partlyPaid++;
        }
        if (paymentStatus.includes('fully')) {
          fullyPaid++;
        }

        // Calculate income from main event
        if ((event.payment_status?.includes('partly') || 
             event.payment_status?.includes('fully')) && 
            event.payment_amount) {
          const amount = typeof event.payment_amount === 'number' 
            ? event.payment_amount 
            : parseFloat(String(event.payment_amount));
          if (!isNaN(amount) && amount > 0) {
            totalIncome += amount;
          }
        }

        // Daily stats (count each event individually)
        if (event.start_date) {
          try {
            const eventDate = parseISO(event.start_date);
            const day = format(eventDate, 'yyyy-MM-dd');
            dailyBookings.set(day, (dailyBookings.get(day) || 0) + 1);

            // Monthly income aggregation
            const month = format(eventDate, 'MMM yyyy');
            if ((event.payment_status?.includes('partly') || 
                 event.payment_status?.includes('fully')) && 
                event.payment_amount) {
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
      });

      // Add income from additional persons (only for regular events, not booking requests)
      additionalPersons.forEach(person => {
        const personPaymentStatus = person.payment_status || '';
        if ((personPaymentStatus.includes('partly') || personPaymentStatus.includes('fully')) && person.payment_amount) {
          const amount = typeof person.payment_amount === 'number' 
            ? person.payment_amount 
            : parseFloat(String(person.payment_amount));
          if (!isNaN(amount) && amount > 0) {
            totalIncome += amount;
            
            // Add to monthly income if person has valid date
            if (person.start_date) {
              try {
                const personDate = parseISO(person.start_date);
                const month = format(personDate, 'MMM yyyy');
                monthlyIncomeMap.set(month, (monthlyIncomeMap.get(month) || 0) + amount);
              } catch (dateError) {
                console.warn('Invalid date in person:', person.start_date);
              }
            }
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

      console.log('🔧 Event stats result for date range:', {
        dateRange: `${startDateStr} to ${endDateStr}`,
        total: result.total,
        partlyPaid: result.partlyPaid,
        fullyPaid: result.fullyPaid,
        totalIncome: result.totalIncome,
        regularEventsCount: regularEvents?.length || 0,
        bookingRequestsCount: bookingRequests?.length || 0,
        additionalPersonsCount: additionalPersons.length
      });

      return result;
    },
    enabled: !!userId,
    staleTime: 3 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  // New customer stats query that counts all persons/customers in events within date range
  const { data: customerStats, isLoading: isLoadingCustomerStats } = useQuery({
    queryKey: ['optimized-customer-stats', userId, dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: async (): Promise<OptimizedCustomerStats> => {
      if (!userId) return { total: 0, withBooking: 0, withoutBooking: 0 };

      console.log('Fetching customer stats for user:', userId, 'date range:', dateRange);

      const startDateStr = dateRange.start.toISOString();
      const endDateStr = dateRange.end.toISOString();

      // Get all customers (including additional persons) from events in the date range
      const { data: eventCustomers, error: eventCustomersError } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', userId)
        .gte('start_date', startDateStr)
        .lte('start_date', endDateStr)
        .is('deleted_at', null);

      if (eventCustomersError) {
        console.error('Error fetching event customers:', eventCustomersError);
        return { total: 0, withBooking: 0, withoutBooking: 0 };
      }

      // Get main persons from regular events in the date range
      const { data: regularEvents, error: regularEventsError } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', userId)
        .gte('start_date', startDateStr)
        .lte('start_date', endDateStr)
        .is('deleted_at', null);

      if (regularEventsError) {
        console.error('Error fetching regular events for customer stats:', regularEventsError);
        return { total: 0, withBooking: 0, withoutBooking: 0 };
      }

      // Get main persons from approved booking requests in the date range
      const { data: bookingRequests, error: bookingRequestsError } = await supabase
        .from('booking_requests')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'approved')
        .gte('start_date', startDateStr)
        .lte('start_date', endDateStr)
        .is('deleted_at', null);

      if (bookingRequestsError) {
        console.error('Error fetching booking requests for customer stats:', bookingRequestsError);
        return { total: 0, withBooking: 0, withoutBooking: 0 };
      }

      // Count all persons/customers
      const additionalPersonsCount = eventCustomers?.length || 0;
      const mainEventsCount = (regularEvents?.length || 0) + (bookingRequests?.length || 0);
      const totalCustomers = additionalPersonsCount + mainEventsCount;

      // All of these are "with booking" since they're all from events
      const withBooking = totalCustomers;
      const withoutBooking = 0; // In this context, all customers are from events

      console.log('Customer stats calculation:', {
        additionalPersons: additionalPersonsCount,
        mainEvents: mainEventsCount,
        total: totalCustomers,
        withBooking,
        withoutBooking
      });

      return {
        total: totalCustomers,
        withBooking,
        withoutBooking
      };
    },
    enabled: !!userId,
    staleTime: 3 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  return { 
    taskStats, 
    eventStats,
    customerStats,
    isLoading: isLoadingTaskStats || isLoadingEventStats || isLoadingCustomerStats
  };
};
