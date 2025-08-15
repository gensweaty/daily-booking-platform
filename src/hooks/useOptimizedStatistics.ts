
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { format, parseISO, startOfMonth, endOfMonth, addMonths, endOfDay } from 'date-fns';

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
      
      // For correctness, skip RPC and use direct query below to ensure archived tasks are excluded consistently across environments.
      // (Previous RPC path could include archived items depending on deployed DB function version.)

      // Fallback to direct aggregation query (exclude archived tasks)
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select('status')
        .eq('user_id', userId)
        .eq('archived', false)
        .is('archived_at', null);

      if (error) {
        console.error('Error fetching tasks:', error);
        return { total: 0, completed: 0, inProgress: 0, todo: 0 };
      }

      const completed = tasks?.filter(t => t.status === 'done').length || 0;
      const inProgress = tasks?.filter(t => t.status === 'inprogress').length || 0;
      const todo = tasks?.filter(t => t.status === 'todo').length || 0;

      const stats = {
        total: completed + inProgress + todo, // ensure total matches board-visible columns only
        completed,
        inProgress,
        todo
      };

      console.log('Direct query task stats:', stats);
      return stats;
    },
    enabled: !!userId,
    staleTime: 10 * 60 * 1000, // 10 minutes - optimized for performance
    gcTime: 15 * 60 * 1000, // 15 minutes - optimized for memory
  });

  // Fixed event stats query to properly handle booking requests in statistics - filter by start_date
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

      // Get regular events from events table (filter by start_date for events happening in the selected period)
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

      // Get approved booking requests from booking_requests table (filter by start_date for events happening in the selected period)
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

      // Transform booking requests to match event structure for statistics
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

      // Get additional persons only for parent events (not child instances) that have events in the date range
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
          .is('deleted_at', null);

        if (!customersError && customers) {
          additionalPersons = customers;
        }
      }

      // Separate recurring events by series for proper payment calculation
      const recurringSeriesMap = new Map<string, any[]>();
      const nonRecurringEvents: any[] = [];

      allEvents.forEach(event => {
        if (event.is_recurring && event.parent_event_id) {
          // This is a recurring instance - group by parent
          const parentId = event.parent_event_id;
          if (!recurringSeriesMap.has(parentId)) {
            recurringSeriesMap.set(parentId, []);
          }
          recurringSeriesMap.get(parentId)?.push(event);
        } else if (event.is_recurring && !event.parent_event_id) {
          // This is a recurring parent - group by its own ID
          if (!recurringSeriesMap.has(event.id)) {
            recurringSeriesMap.set(event.id, []);
          }
          recurringSeriesMap.get(event.id)?.push(event);
        } else {
          // Non-recurring event
          nonRecurringEvents.push(event);
        }
      });

      console.log(`Processing ${recurringSeriesMap.size} recurring series and ${nonRecurringEvents.length} non-recurring events`);

      // Count unique events in the selected date range
      const totalEvents = allEvents.length;

      let partlyPaid = 0;
      let fullyPaid = 0;
      let totalIncome = 0;

      const dailyBookings = new Map<string, number>();
      const monthlyIncomeMap = new Map<string, number>();

      // Process non-recurring events normally
      nonRecurringEvents.forEach(event => {
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

      // Process recurring series - count payments only once per series per unique person
      for (const [seriesId, seriesEvents] of recurringSeriesMap) {
        console.log(`Processing recurring series ${seriesId} with ${seriesEvents.length} instances`);
        
        // For payment status, check if ANY instance in the series has payments
        let hasPartlyPaid = false;
        let hasFullyPaid = false;
        
        // For income calculation, use the payment amount from the FIRST instance only
        // (assuming all instances in a series have the same payment details)
        const firstInstance = seriesEvents[0];
        
        seriesEvents.forEach(instance => {
          const paymentStatus = instance.payment_status || '';
          if (paymentStatus.includes('partly')) hasPartlyPaid = true;
          if (paymentStatus.includes('fully')) hasFullyPaid = true;

          // Count each instance for daily stats
          if (instance.start_date) {
            try {
              const eventDate = parseISO(instance.start_date);
              const day = format(eventDate, 'yyyy-MM-dd');
              dailyBookings.set(day, (dailyBookings.get(day) || 0) + 1);
            } catch (dateError) {
              console.warn('Invalid date in recurring instance:', instance.start_date);
            }
          }
        });

        // Count payment status once per series
        if (hasPartlyPaid && !hasFullyPaid) partlyPaid++;
        if (hasFullyPaid) fullyPaid++;

        // Add income only once per series (from first instance)
        if ((firstInstance.payment_status?.includes('partly') || 
             firstInstance.payment_status?.includes('fully')) && 
            firstInstance.payment_amount) {
          const amount = typeof firstInstance.payment_amount === 'number' 
            ? firstInstance.payment_amount 
            : parseFloat(String(firstInstance.payment_amount));
          if (!isNaN(amount) && amount > 0) {
            totalIncome += amount;
            console.log(`Added ${amount} from recurring series ${seriesId} (counted once)`);

            // Add to monthly income only once per series
            if (firstInstance.start_date) {
              try {
                const eventDate = parseISO(firstInstance.start_date);
                const month = format(eventDate, 'MMM yyyy');
                monthlyIncomeMap.set(month, (monthlyIncomeMap.get(month) || 0) + amount);
              } catch (dateError) {
                console.warn('Invalid date in recurring series:', firstInstance.start_date);
              }
            }
          }
        }

        // Get additional persons for this series and count their payments only once
        const seriesAdditionalPersons = additionalPersons.filter(person => 
          person.event_id === seriesId
        );

        seriesAdditionalPersons.forEach(person => {
          const personPaymentStatus = person.payment_status || '';
          if ((personPaymentStatus.includes('partly') || personPaymentStatus.includes('fully')) && person.payment_amount) {
            const amount = typeof person.payment_amount === 'number' 
              ? person.payment_amount 
              : parseFloat(String(person.payment_amount));
            if (!isNaN(amount) && amount > 0) {
              totalIncome += amount;
              console.log(`Added ${amount} from additional person in recurring series ${seriesId} (counted once)`);
              
              // Add to monthly income
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
      }

      // Add income from additional persons for non-recurring events
      const nonRecurringAdditionalPersons = additionalPersons.filter(person => 
        !recurringSeriesMap.has(person.event_id || '')
      );

      nonRecurringAdditionalPersons.forEach(person => {
        const personPaymentStatus = person.payment_status || '';
        if ((personPaymentStatus.includes('partly') || personPaymentStatus.includes('fully')) && person.payment_amount) {
          const amount = typeof person.payment_amount === 'number' 
            ? person.payment_amount 
            : parseFloat(String(person.payment_amount));
          if (!isNaN(amount) && amount > 0) {
            totalIncome += amount;
            
            // Add to monthly income
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

      console.log('🔧 Event stats result with booking requests included:', {
        dateRange: `${startDateStr} to ${endDateStr}`,
        total: result.total,
        partlyPaid: result.partlyPaid,
        fullyPaid: result.fullyPaid,
        totalIncome: result.totalIncome,
        regularEventsCount: regularEvents?.length || 0,
        bookingRequestsCount: bookingRequests?.length || 0,
        additionalPersonsCount: additionalPersons.length,
        recurringSeriesCount: recurringSeriesMap.size
      });

      return result;
    },
    enabled: !!userId,
    staleTime: 8 * 60 * 1000, // Increased for better performance
    gcTime: 20 * 60 * 1000, // Increased for memory optimization
  });

  // Fixed customer stats query to properly count booking request customers - filter by start_date
  const { data: customerStats, isLoading: isLoadingCustomerStats } = useQuery({
    queryKey: ['optimized-customer-stats', userId, dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: async (): Promise<OptimizedCustomerStats> => {
      if (!userId) return { total: 0, withBooking: 0, withoutBooking: 0 };

      console.log('Fetching customer stats for user:', userId, 'date range:', dateRange);

      const startDateStr = dateRange.start.toISOString();
      const endDateStr = endOfDay(dateRange.end).toISOString();

      // Track unique customers and split into with/without booking sets
      const uniqueCustomers = new Set<string>();
      const withBookingSet = new Set<string>();
      const withoutBookingSet = new Set<string>();

      // Get regular events in the date range (main persons) - filter by start_date for events happening in this period
      const { data: regularEvents, error: regularEventsError } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', startDateStr)
        .lte('created_at', endDateStr)
        .is('parent_event_id', null)
        .is('deleted_at', null);

      if (regularEventsError) {
        console.error('Error fetching regular events for customer stats:', regularEventsError);
      } else if (regularEvents) {
        // Add main event persons as unique customers (WITH booking)
        regularEvents.forEach(event => {
          const customerKey = `${event.social_network_link || 'no-email'}_${event.user_number || 'no-phone'}_${event.user_surname || 'no-name'}`;
          uniqueCustomers.add(customerKey);
          withBookingSet.add(customerKey);
          console.log('Added event customer:', { email: event.social_network_link, phone: event.user_number, name: event.user_surname });
        });
      }

      // Get approved booking requests in the date range (main persons) - filter by start_date for events happening in this period
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
      }
      // Booking requests are intentionally excluded from customerStats to match CRM page counts.

      // Get additional customers from CRM (type = 'customer') created in the date range
      const { data: crmCustomers, error: crmCustomersError } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'customer')
        .gte('created_at', startDateStr)
        .lte('created_at', endDateStr)
        .is('deleted_at', null);

      if (crmCustomersError) {
        console.error('Error fetching CRM customers for customer stats:', crmCustomersError);
      } else if (crmCustomers) {
        // These are additional persons for events (WITH booking)
        crmCustomers.forEach(customer => {
          const customerKey = `${customer.social_network_link || 'no-email'}_${customer.user_number || 'no-phone'}_${customer.user_surname || customer.title || 'no-name'}`;
          uniqueCustomers.add(customerKey);
          withBookingSet.add(customerKey);
          console.log('Added CRM customer (event-linked):', { email: customer.social_network_link, phone: customer.user_number, name: customer.user_surname || customer.title });
        });
      }

      // Get ALL standalone CRM customers (not just those created in date range)
      const { data: standaloneCrmCustomers, error: standaloneCrmError } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', userId)
        .or('type.neq.customer,type.is.null') // Get customers that are NOT additional persons
        .is('event_id', null) // Not associated with events
        .gte('created_at', startDateStr)
        .lte('created_at', endDateStr)
        .is('deleted_at', null);

      if (standaloneCrmError) {
        console.error('Error fetching standalone CRM customers:', standaloneCrmError);
      } else if (standaloneCrmCustomers) {
        // Standalone CRM customers (WITHOUT booking)
        standaloneCrmCustomers.forEach(customer => {
          const customerKey = `${customer.social_network_link || 'no-email'}_${customer.user_number || 'no-phone'}_${customer.user_surname || customer.title || 'no-name'}`;
          uniqueCustomers.add(customerKey);
          withoutBookingSet.add(customerKey);
          console.log('Added standalone CRM customer:', { email: customer.social_network_link, phone: customer.user_number, name: customer.user_surname || customer.title });
        });
      }

      // Ensure customers that appear in both sets are counted as WITH booking
      for (const key of withBookingSet) {
        if (withoutBookingSet.has(key)) withoutBookingSet.delete(key);
      }

      const totalCustomers = uniqueCustomers.size;
      const withBooking = withBookingSet.size;
      const withoutBooking = withoutBookingSet.size;

      console.log('Final customer stats calculation (including booking requests):', {
        uniqueCustomersFound: uniqueCustomers.size,
        totalCustomers,
        withBooking,
        withoutBooking,
        regularEventsCount: regularEvents?.length || 0,
        bookingRequestsCount: bookingRequests?.length || 0,
        crmCustomersCount: crmCustomers?.length || 0,
        standaloneCrmCustomersCount: standaloneCrmCustomers?.length || 0
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
