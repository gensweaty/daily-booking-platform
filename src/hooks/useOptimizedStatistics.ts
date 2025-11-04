
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { format, parseISO, endOfDay, subMonths, startOfMonth, endOfMonth } from 'date-fns';

interface OptimizedTaskStats {
  total: number;
  completed: number;
  inProgress: number;
  todo: number;
  currentPeriod?: {
    total: number;
  };
  previousPeriod?: {
    total: number;
  };
}

interface OptimizedEventStats {
  total: number;
  partlyPaid: number;
  fullyPaid: number;
  totalIncome: number;
  eventIncome: number;
  standaloneCustomerIncome: number;
  monthlyIncome: Array<{ month: string; income: number }>;
  threeMonthIncome: Array<{ month: string; income: number }>;
  dailyStats: Array<{ day: string; date: Date; month: string; bookings: number }>;
  events: Array<any>;
  currentPeriod?: {
    total: number;
    partlyPaid: number;
    fullyPaid: number;
    totalIncome: number;
  };
  previousPeriod?: {
    total: number;
    partlyPaid: number;
    fullyPaid: number;
    totalIncome: number;
  };
}

interface OptimizedCustomerStats {
  total: number;
  withBooking: number;
  withoutBooking: number;
  currentPeriod?: {
    total: number;
  };
  previousPeriod?: {
    total: number;
  };
}

export const useOptimizedStatistics = (userId: string | undefined, dateRange: { start: Date; end: Date }) => {
  // Helper to parse payment amounts safely
  const parsePaymentAmount = (amount: any): number => {
    if (amount === null || amount === undefined) return 0;
    if (amount === 'NaN' || amount === '') return 0;
    
    if (typeof amount === 'string') {
      try {
        const cleanedStr = amount.replace(',', '.').replace(/[^0-9.-]+/g, '');
        const parsed = parseFloat(cleanedStr);
        return isNaN(parsed) ? 0 : parsed;
      } catch (e) {
        return 0;
      }
    }
    
    if (typeof amount === 'number') {
      return isNaN(amount) ? 0 : amount;
    }
    
    try {
      const converted = Number(amount);
      return isNaN(converted) ? 0 : converted;
    } catch (e) {
      return 0;
    }
  };

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
        .select('status, created_at')
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
      const currentTotal = completed + inProgress + todo;

      // Calculate current and previous period for month-to-date comparison
      // Always compare current month (1st to today) vs previous month (1st to same day)
      const now = new Date();
      const currentDay = now.getDate();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      
      // Current period: 1st of current month to today
      const currentPeriodStart = new Date(currentYear, currentMonth, 1);
      const currentPeriodEnd = new Date(currentYear, currentMonth, currentDay, 23, 59, 59, 999);

      const currStartStr = currentPeriodStart.toISOString();
      const currEndStr = currentPeriodEnd.toISOString();

      // Get current period tasks (month-to-date)
      const { data: currTasks } = await supabase
        .from('tasks')
        .select('status')
        .eq('user_id', userId)
        .eq('archived', false)
        .is('archived_at', null)
        .gte('created_at', currStartStr)
        .lte('created_at', currEndStr);
      
      const currTotal = currTasks?.length || 0;
      
      // Previous period: 1st of previous month to same day (or last day if previous month is shorter)
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const prevPeriodStart = new Date(prevYear, prevMonth, 1);
      
      // Get the last day of the previous month to handle edge cases
      const lastDayOfPrevMonth = new Date(prevYear, prevMonth + 1, 0).getDate();
      const prevDay = Math.min(currentDay, lastDayOfPrevMonth);
      const prevPeriodEnd = new Date(prevYear, prevMonth, prevDay, 23, 59, 59, 999);

      const prevStartStr = prevPeriodStart.toISOString();
      const prevEndStr = prevPeriodEnd.toISOString();

      // Get previous period tasks for comparison (same duration)
      const { data: prevTasks } = await supabase
        .from('tasks')
        .select('status')
        .eq('user_id', userId)
        .eq('archived', false)
        .is('archived_at', null)
        .gte('created_at', prevStartStr)
        .lte('created_at', prevEndStr);
      
      const prevTotal = prevTasks?.length || 0;

      return {
        total: currentTotal,
        completed,
        inProgress,
        todo,
        currentPeriod: { total: currTotal },
        previousPeriod: { total: prevTotal }
      };
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
        eventIncome: 0,
        standaloneCustomerIncome: 0,
        monthlyIncome: [],
        threeMonthIncome: [],
        dailyStats: [],
        events: []
      };

      console.log('Fetching event stats for user:', userId, 'date range:', dateRange);

      // CRITICAL FIX: Ensure end date includes the entire day (23:59:59.999)
      const startDateStr = dateRange.start.toISOString();
      const endOfDayDate = new Date(dateRange.end);
      endOfDayDate.setHours(23, 59, 59, 999);
      const endDateStr = endOfDayDate.toISOString();
      
      console.log(`📅 Date range: ${startDateStr} to ${endDateStr}`);

      // Get regular events from events table (filter by start_date for events happening in the selected period)
      // CRITICAL FIX: Only fetch non-recurring events OR parent recurring events (not child instances)
      // This prevents double-counting recurring series
      const { data: regularEvents, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', userId)
        .gte('start_date', startDateStr)
        .lte('start_date', endDateStr)
        .is('deleted_at', null)
        .or('is_recurring.is.null,is_recurring.eq.false,and(is_recurring.eq.true,parent_event_id.is.null)');

      if (eventsError) {
        console.error('Error fetching regular events:', eventsError);
        return {
          total: 0,
          partlyPaid: 0,
          fullyPaid: 0,
          totalIncome: 0,
          eventIncome: 0,
          standaloneCustomerIncome: 0,
          monthlyIncome: [],
          threeMonthIncome: [],
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
          eventIncome: 0,
          standaloneCustomerIncome: 0,
          monthlyIncome: [],
          threeMonthIncome: [],
          dailyStats: [],
          events: []
        };
      }

      // CRITICAL FIX: Exclude booking requests that were already converted to events
      // Check which booking requests have been converted to events by matching booking_request_id
      const bookingRequestIdsInEvents = new Set(
        (regularEvents || [])
          .filter(event => event.booking_request_id)
          .map(event => event.booking_request_id)
      );

      // Filter out booking requests that were already converted to events
      const unconvertedBookingRequests = (bookingRequests || []).filter(
        booking => !bookingRequestIdsInEvents.has(booking.id)
      );

      // Transform remaining booking requests to match event structure for statistics
      const transformedBookingRequests = unconvertedBookingRequests.map(booking => ({
        ...booking,
        type: 'booking_request',
        title: booking.title,
        user_surname: booking.requester_name,
        user_number: booking.requester_phone,
        social_network_link: booking.requester_email,
        event_notes: booking.description
      }));

      // Count payment status for booking requests
      transformedBookingRequests.forEach(booking => {
        const paymentStatus = booking.payment_status || '';
        
        // CRITICAL FIX: Count booking requests payment status
        if (paymentStatus === 'partly_paid' || paymentStatus.includes('partly')) {
          partlyPaid++;
        } else if (paymentStatus === 'fully_paid' || paymentStatus.includes('fully')) {
          fullyPaid++;
        }

        // Count income from booking requests
        if ((paymentStatus.includes('partly') || paymentStatus.includes('fully')) && booking.payment_amount) {
          const amount = typeof booking.payment_amount === 'number' 
            ? booking.payment_amount 
            : parseFloat(String(booking.payment_amount));
          if (!isNaN(amount) && amount > 0) {
            totalIncome += amount;
            eventIncome += amount;
          }
        }

        // Daily stats for booking requests
        if (booking.start_date) {
          try {
            const bookingDate = parseISO(booking.start_date);
            const day = format(bookingDate, 'yyyy-MM-dd');
            dailyBookings.set(day, (dailyBookings.get(day) || 0) + 1);

            // Monthly income aggregation
            const month = format(bookingDate, 'MMM yyyy');
            if ((paymentStatus.includes('partly') || paymentStatus.includes('fully')) && booking.payment_amount) {
              const amount = typeof booking.payment_amount === 'number' 
                ? booking.payment_amount 
                : parseFloat(String(booking.payment_amount));
              if (!isNaN(amount) && amount > 0) {
                monthlyIncomeMap.set(month, (monthlyIncomeMap.get(month) || 0) + amount);
              }
            }
          } catch (dateError) {
            console.warn('Invalid date in booking request:', booking.start_date);
          }
        }
      });

      // Combine both types of events (no double counting now)
      const allEvents = [
        ...(regularEvents || []),
        ...transformedBookingRequests
      ];

      console.log(`🔍 EVENT COUNT DEBUG: ${regularEvents?.length || 0} regular events, ${bookingRequests?.length || 0} total booking requests, ${unconvertedBookingRequests.length} unconverted booking requests, ${bookingRequestIdsInEvents.size} already converted to events`);

      console.log(`Found ${regularEvents?.length || 0} regular events and ${bookingRequests?.length || 0} approved booking requests in date range`);

      // PERFORMANCE: Batch fetch additional persons for all parent events
      const parentEventIds = new Set<string>();
      
      regularEvents?.forEach(event => {
        if (!event.parent_event_id) {
          parentEventIds.add(event.id);
        } else {
          parentEventIds.add(event.parent_event_id);
        }
      });

      let additionalPersons: any[] = [];
      if (parentEventIds.size > 0) {
        const { data: customers, error: customersError } = await supabase
          .from('customers')
          .select('id, event_id, payment_status, payment_amount, start_date, type')
          .in('event_id', Array.from(parentEventIds))
          .eq('type', 'customer')
          .is('deleted_at', null);

        if (!customersError && customers) {
          additionalPersons = customers;
          console.log(`Fetched ${customers.length} additional persons for ${parentEventIds.size} parent events`);
        }
      }

      // Separate recurring parent events from non-recurring events
      // Since we only fetch parent events now, we just need to separate by is_recurring flag
      const recurringEvents: any[] = [];
      const nonRecurringEvents: any[] = [];

      allEvents.forEach(event => {
        if (event.is_recurring) {
          recurringEvents.push(event);
        } else {
          nonRecurringEvents.push(event);
        }
      });

      console.log(`✅ EVENT COUNT FIX: Found ${recurringEvents.length} recurring series and ${nonRecurringEvents.length} non-recurring events`);
      console.log(`📊 Total unique events: ${allEvents.length}`);

      // Count unique events: Since we only fetch parent events, total is simply allEvents.length
      // Each recurring series (parent) counts as ONE event, each non-recurring event counts as ONE
      const totalEvents = allEvents.length;

      let partlyPaid = 0;
      let fullyPaid = 0;
      let totalIncome = 0;
      let eventIncome = 0;

      const dailyBookings = new Map<string, number>();
      const monthlyIncomeMap = new Map<string, number>();

      // Process non-recurring events normally
      nonRecurringEvents.forEach(event => {
        const paymentStatus = event.payment_status || '';
        
        // CRITICAL FIX: Check for exact status to avoid double counting
        // "fully_paid" should only count as fully paid, not partly paid
        if (paymentStatus === 'partly_paid' || paymentStatus.includes('partly')) {
          partlyPaid++;
        } else if (paymentStatus === 'fully_paid' || paymentStatus.includes('fully')) {
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
            eventIncome += amount;
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

      // Process recurring parent events - since we only fetch parents now, treat them like normal events
      recurringEvents.forEach(event => {
        const paymentStatus = event.payment_status || '';
        
        // CRITICAL FIX: Check for exact status to avoid double counting
        if (paymentStatus === 'partly_paid' || paymentStatus.includes('partly')) {
          partlyPaid++;
        } else if (paymentStatus === 'fully_paid' || paymentStatus.includes('fully')) {
          fullyPaid++;
        }

        // Calculate income from main event (counted once per series)
        if ((event.payment_status?.includes('partly') || 
             event.payment_status?.includes('fully')) && 
            event.payment_amount) {
          const amount = typeof event.payment_amount === 'number' 
            ? event.payment_amount 
            : parseFloat(String(event.payment_amount));
          if (!isNaN(amount) && amount > 0) {
            totalIncome += amount;
            eventIncome += amount;
            console.log(`Added ${amount} from recurring series ${event.id} (counted once)`);
          }
        }

        // Daily stats for parent recurring event
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
            console.warn('Invalid date in recurring event:', event.start_date);
          }
        }

        // Get additional persons for this recurring series
        const seriesAdditionalPersons = additionalPersons.filter(person => 
          person.event_id === event.id
        );

        seriesAdditionalPersons.forEach(person => {
          const personPaymentStatus = person.payment_status || '';
          if ((personPaymentStatus.includes('partly') || personPaymentStatus.includes('fully')) && person.payment_amount) {
            const amount = typeof person.payment_amount === 'number' 
              ? person.payment_amount 
              : parseFloat(String(person.payment_amount));
            if (!isNaN(amount) && amount > 0) {
              totalIncome += amount;
              eventIncome += amount;
              console.log(`Added ${amount} from additional person in recurring series ${event.id} (counted once)`);
              
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
      });

      // Add income from additional persons for non-recurring events
      const recurringEventIds = new Set(recurringEvents.map(e => e.id));
      const nonRecurringAdditionalPersons = additionalPersons.filter(person => 
        !recurringEventIds.has(person.event_id || '')
      );

      nonRecurringAdditionalPersons.forEach(person => {
        const personPaymentStatus = person.payment_status || '';
        if ((personPaymentStatus.includes('partly') || personPaymentStatus.includes('fully')) && person.payment_amount) {
          const amount = typeof person.payment_amount === 'number' 
            ? person.payment_amount 
            : parseFloat(String(person.payment_amount));
          if (!isNaN(amount) && amount > 0) {
            totalIncome += amount;
            eventIncome += amount;
            
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

      // Get standalone customers income (customers without events)
      // PERFORMANCE: Select only needed fields
      const { data: standaloneCustomers, error: standaloneError } = await supabase
        .from('customers')
        .select('id, payment_status, payment_amount, created_at')
        .eq('user_id', userId)
        .is('event_id', null)
        .gte('created_at', startDateStr)
        .lte('created_at', endDateStr)
        .is('deleted_at', null);

      let standaloneCustomerIncome = 0;
      if (!standaloneError && standaloneCustomers) {
        console.log(`Found ${standaloneCustomers.length} standalone customers in date range`);
        standaloneCustomers.forEach(customer => {
          const paymentStatus = customer.payment_status || '';
          if ((paymentStatus.includes('partly') || paymentStatus.includes('fully')) && customer.payment_amount) {
            const amount = parsePaymentAmount(customer.payment_amount);
            if (amount > 0) {
              standaloneCustomerIncome += amount;
              totalIncome += amount;
              console.log(`Added ${amount} from standalone customer ${customer.id}`);
            }
          }
        });
      }

      console.log('Income breakdown:', {
        eventIncome,
        standaloneCustomerIncome,
        totalIncome
      });

      const monthlyIncome = Array.from(monthlyIncomeMap.entries()).map(([month, income]) => ({
        month,
        income
      }));

      // Generate 3-month income comparison using the SAME logic as main calculation
      const today = new Date();
      const threeMonthIncome = [];
      
      // Calculate each month individually using the exact same logic as the main calculation
      for (let i = 0; i < 3; i++) {
        const monthDate = subMonths(today, 2 - i);
        const monthStart = startOfMonth(monthDate);
        const monthEnd = endOfMonth(monthDate);
        const monthKey = format(monthDate, 'MMM yyyy');
        const monthShort = format(monthDate, 'MMM');
        
        console.log(`Calculating 3-month data for ${monthKey} (${monthStart.toISOString()} to ${monthEnd.toISOString()})`);
        
        // Use EXACT same logic as main calculation but for this specific month
        let monthIncome = 0;
        let monthEventIncome = 0;
        let monthCustomerIncome = 0;
        
        // Query events for this specific month with optimized field selection
        const monthStartStr = monthStart.toISOString();
        const monthEndOfDay = new Date(monthEnd);
        monthEndOfDay.setHours(23, 59, 59, 999);
        const monthEndStr = monthEndOfDay.toISOString();
        
        const { data: monthEvents, error: monthEventsError } = await supabase
          .from('events')
          .select('id, user_id, payment_status, payment_amount, start_date, is_recurring, parent_event_id')
          .eq('user_id', userId)
          .gte('start_date', monthStartStr)
          .lte('start_date', monthEndStr)
          .is('deleted_at', null);

        // Query booking requests for this specific month with optimized field selection
        const { data: monthBookingRequests, error: monthBookingError } = await supabase
          .from('booking_requests')
          .select('id, user_id, payment_status, payment_amount, start_date')
          .eq('user_id', userId)
          .gte('start_date', monthStartStr)
          .lte('start_date', monthEndStr)
          .eq('status', 'approved')
          .is('deleted_at', null);

        if (!monthEventsError && monthEvents) {
          // Transform booking requests to look like events (same as main logic)
          const transformedMonthBookings = (monthBookingRequests || []).map((booking: any) => ({
            ...booking,
            is_recurring: false,
            parent_event_id: null,
            type: 'booking_request'
          }));

          const allMonthEvents = [
            ...monthEvents,
            ...transformedMonthBookings
          ];

          // Apply EXACT same recurring logic as main calculation
          const monthRecurringSeriesMap = new Map<string, any[]>();
          const monthNonRecurringEvents: any[] = [];

          allMonthEvents.forEach(event => {
            if (event.is_recurring && event.parent_event_id) {
              const parentId = event.parent_event_id;
              if (!monthRecurringSeriesMap.has(parentId)) {
                monthRecurringSeriesMap.set(parentId, []);
              }
              monthRecurringSeriesMap.get(parentId)?.push(event);
            } else if (event.is_recurring && !event.parent_event_id) {
              if (!monthRecurringSeriesMap.has(event.id)) {
                monthRecurringSeriesMap.set(event.id, []);
              }
              monthRecurringSeriesMap.get(event.id)?.push(event);
            } else {
              monthNonRecurringEvents.push(event);
            }
          });

          // Process non-recurring events (same as main logic)
          monthNonRecurringEvents.forEach(event => {
            if ((event.payment_status?.includes('partly') || event.payment_status?.includes('fully')) && event.payment_amount) {
              const amount = typeof event.payment_amount === 'number' 
                ? event.payment_amount 
                : parseFloat(String(event.payment_amount));
              if (!isNaN(amount) && amount > 0) {
                monthIncome += amount;
                monthEventIncome += amount;
              }
            }
          });

          // Process recurring series (same as main logic - count once per series)
          for (const [seriesId, seriesEvents] of monthRecurringSeriesMap) {
            const firstInstance = seriesEvents[0];
            if ((firstInstance.payment_status?.includes('partly') || firstInstance.payment_status?.includes('fully')) && firstInstance.payment_amount) {
              const amount = typeof firstInstance.payment_amount === 'number' 
                ? firstInstance.payment_amount 
                : parseFloat(String(firstInstance.payment_amount));
              if (!isNaN(amount) && amount > 0) {
                monthIncome += amount;
                monthEventIncome += amount;
              }
            }
          }

          // Get additional persons (customers) for events in this month (optimized)
          const monthParentEventIds = monthEvents
            ?.filter(event => !event.parent_event_id)
            .map(event => event.id) || [];

          if (monthParentEventIds.length > 0) {
            const { data: monthCustomers, error: monthCustomersError } = await supabase
              .from('customers')
              .select('id, event_id, payment_status, payment_amount')
              .in('event_id', monthParentEventIds)
              .eq('type', 'customer')
              .is('deleted_at', null);

            if (!monthCustomersError && monthCustomers) {
              // Process customers for recurring series (same as main logic)
              for (const [seriesId] of monthRecurringSeriesMap) {
                const seriesAdditionalPersons = monthCustomers.filter(person => 
                  person.event_id === seriesId
                );

                seriesAdditionalPersons.forEach(person => {
                  const personPaymentStatus = person.payment_status || '';
                  if ((personPaymentStatus.includes('partly') || personPaymentStatus.includes('fully')) && person.payment_amount) {
                    const amount = typeof person.payment_amount === 'number' 
                      ? person.payment_amount 
                      : parseFloat(String(person.payment_amount));
                    if (!isNaN(amount) && amount > 0) {
                      monthIncome += amount;
                      monthEventIncome += amount;
                    }
                  }
                });
              }

              // Process customers for non-recurring events (same as main logic)
              const nonRecurringAdditionalPersons = monthCustomers.filter(person => 
                !monthRecurringSeriesMap.has(person.event_id || '')
              );

              nonRecurringAdditionalPersons.forEach(person => {
                const personPaymentStatus = person.payment_status || '';
                if ((personPaymentStatus.includes('partly') || personPaymentStatus.includes('fully')) && person.payment_amount) {
                  const amount = typeof person.payment_amount === 'number' 
                    ? person.payment_amount 
                    : parseFloat(String(person.payment_amount));
                  if (!isNaN(amount) && amount > 0) {
                    monthIncome += amount;
                    monthEventIncome += amount;
                  }
                }
              });
            }
          }
        }

        // Query standalone customers for this month with optimized field selection
        const { data: monthStandaloneCustomers, error: monthStandaloneError } = await supabase
          .from('customers')
          .select('id, payment_status, payment_amount')
          .eq('user_id', userId)
          .is('event_id', null)
          .gte('created_at', monthStartStr)
          .lte('created_at', monthEndStr)
          .is('deleted_at', null);

        if (!monthStandaloneError && monthStandaloneCustomers) {
          monthStandaloneCustomers.forEach(customer => {
            const paymentStatus = customer.payment_status || '';
            if ((paymentStatus.includes('partly') || paymentStatus.includes('fully')) && customer.payment_amount) {
              const amount = parsePaymentAmount(customer.payment_amount);
              if (amount > 0) {
                monthIncome += amount;
                monthCustomerIncome += amount;
              }
            }
          });
        }

        threeMonthIncome.push({
          month: monthShort,
          income: monthIncome,
          eventIncome: monthEventIncome,
          customerIncome: monthCustomerIncome
        });

        console.log(`Month ${monthKey} income: ${monthIncome} (events: ${monthEventIncome}, customers: ${monthCustomerIncome})`);
      }


      // Calculate period stats for month-to-date comparison
      // Always compare current month (1st to today) vs previous month (1st to same day)
      const now = new Date();
      const currentDay = now.getDate();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      
      // Current period: 1st of current month to today
      const currentPeriodStart = new Date(currentYear, currentMonth, 1);
      const currentPeriodEnd = new Date(currentYear, currentMonth, currentDay, 23, 59, 59, 999);
      
      // Previous period: 1st of previous month to same day (or last day if previous month is shorter)
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const prevPeriodStart = new Date(prevYear, prevMonth, 1);
      
      // Get the last day of the previous month to handle edge cases
      const lastDayOfPrevMonth = new Date(prevYear, prevMonth + 1, 0).getDate();
      const prevDay = Math.min(currentDay, lastDayOfPrevMonth);
      const prevPeriodEnd = new Date(prevYear, prevMonth, prevDay, 23, 59, 59, 999);

      console.log('📊 EVENT STATS - Period Calculation:', {
        today: now.toISOString(),
        currentDay,
        currentPeriod: {
          start: currentPeriodStart.toISOString(),
          end: currentPeriodEnd.toISOString()
        },
        previousPeriod: {
          start: prevPeriodStart.toISOString(),
          end: prevPeriodEnd.toISOString()
        }
      });

      // Fetch current period events (month-to-date)
      const currStartStr = currentPeriodStart.toISOString();
      const currEndStr = currentPeriodEnd.toISOString();

      const { data: currEvents } = await supabase
        .from('events')
        .select('id, payment_status, payment_amount, booking_request_id')
        .eq('user_id', userId)
        .gte('start_date', currStartStr)
        .lte('start_date', currEndStr)
        .is('deleted_at', null)
        .or('is_recurring.is.null,is_recurring.eq.false,and(is_recurring.eq.true,parent_event_id.is.null)');

      const { data: currBookings } = await supabase
        .from('booking_requests')
        .select('id, payment_status, payment_amount')
        .eq('user_id', userId)
        .eq('status', 'approved')
        .gte('start_date', currStartStr)
        .lte('start_date', currEndStr)
        .is('deleted_at', null);

      const currBookingIdsInEvents = new Set(
        (currEvents || []).filter(e => e.booking_request_id).map(e => e.booking_request_id)
      );
      const currUnconvertedBookings = (currBookings || []).filter(b => !currBookingIdsInEvents.has(b.id));

      let currTotal = (currEvents?.length || 0) + currUnconvertedBookings.length;
      let currPartlyPaid = 0;
      let currFullyPaid = 0;
      let currTotalIncome = 0;

      [...(currEvents || []), ...currUnconvertedBookings].forEach(item => {
        const status = item.payment_status || '';
        if (status === 'partly_paid' || status.includes('partly')) {
          currPartlyPaid++;
        } else if (status === 'fully_paid' || status.includes('fully')) {
          currFullyPaid++;
        }
        if ((status.includes('partly') || status.includes('fully')) && item.payment_amount) {
          const amt = parsePaymentAmount(item.payment_amount);
          if (amt > 0) currTotalIncome += amt;
        }
      });

      // Fetch customers associated with current period events (by event start_date)
      const currEventIds = (currEvents || []).filter(e => !e.booking_request_id).map(e => e.id);
      if (currEventIds.length > 0) {
        const { data: currCustomers } = await supabase
          .from('customers')
          .select('id, event_id, payment_status, payment_amount')
          .in('event_id', currEventIds)
          .eq('type', 'customer')
          .is('deleted_at', null);

        if (currCustomers) {
          currTotal += currCustomers.length;
          currCustomers.forEach(customer => {
            const status = customer.payment_status || '';
            if (status === 'partly_paid' || status.includes('partly')) {
              currPartlyPaid++;
            } else if (status === 'fully_paid' || status.includes('fully')) {
              currFullyPaid++;
            }
            if ((status.includes('partly') || status.includes('fully')) && customer.payment_amount) {
              const amt = parsePaymentAmount(customer.payment_amount);
              if (amt > 0) currTotalIncome += amt;
            }
          });
        }
      }

      // Fetch previous period events for comparison
      const prevStartStr = prevPeriodStart.toISOString();
      const prevEndStr = prevPeriodEnd.toISOString();

      const { data: prevEvents } = await supabase
        .from('events')
        .select('id, payment_status, payment_amount, booking_request_id')
        .eq('user_id', userId)
        .gte('start_date', prevStartStr)
        .lte('start_date', prevEndStr)
        .is('deleted_at', null)
        .or('is_recurring.is.null,is_recurring.eq.false,and(is_recurring.eq.true,parent_event_id.is.null)');

      const { data: prevBookings } = await supabase
        .from('booking_requests')
        .select('id, payment_status, payment_amount')
        .eq('user_id', userId)
        .eq('status', 'approved')
        .gte('start_date', prevStartStr)
        .lte('start_date', prevEndStr)
        .is('deleted_at', null);

      const prevBookingIdsInEvents = new Set(
        (prevEvents || []).filter(e => e.booking_request_id).map(e => e.booking_request_id)
      );
      const prevUnconvertedBookings = (prevBookings || []).filter(b => !prevBookingIdsInEvents.has(b.id));

      let prevTotal = (prevEvents?.length || 0) + prevUnconvertedBookings.length;
      let prevPartlyPaid = 0;
      let prevFullyPaid = 0;
      let prevTotalIncome = 0;

      [...(prevEvents || []), ...prevUnconvertedBookings].forEach(item => {
        const status = item.payment_status || '';
        if (status === 'partly_paid' || status.includes('partly')) {
          prevPartlyPaid++;
        } else if (status === 'fully_paid' || status.includes('fully')) {
          prevFullyPaid++;
        }
        if ((status.includes('partly') || status.includes('fully')) && item.payment_amount) {
          const amt = parsePaymentAmount(item.payment_amount);
          if (amt > 0) prevTotalIncome += amt;
        }
      });

      // Fetch customers associated with previous period events (by event start_date)
      const prevEventIds = (prevEvents || []).filter(e => !e.booking_request_id).map(e => e.id);
      if (prevEventIds.length > 0) {
        const { data: prevCustomers } = await supabase
          .from('customers')
          .select('id, event_id, payment_status, payment_amount')
          .in('event_id', prevEventIds)
          .eq('type', 'customer')
          .is('deleted_at', null);

        if (prevCustomers) {
          prevTotal += prevCustomers.length;
          prevCustomers.forEach(customer => {
            const status = customer.payment_status || '';
            if (status === 'partly_paid' || status.includes('partly')) {
              prevPartlyPaid++;
            } else if (status === 'fully_paid' || status.includes('fully')) {
              prevFullyPaid++;
            }
            if ((status.includes('partly') || status.includes('fully')) && customer.payment_amount) {
              const amt = parsePaymentAmount(customer.payment_amount);
              if (amt > 0) prevTotalIncome += amt;
            }
          });
        }
      }

      console.log('📊 EVENT STATS - Period Comparison Results:', {
        currentPeriod: {
          total: currTotal,
          events: currEvents?.length,
          bookings: currUnconvertedBookings.length,
          customers: currTotal - (currEvents?.length || 0) - currUnconvertedBookings.length,
          totalIncome: currTotalIncome
        },
        previousPeriod: {
          total: prevTotal,
          events: prevEvents?.length,
          bookings: prevUnconvertedBookings.length,
          customers: prevTotal - (prevEvents?.length || 0) - prevUnconvertedBookings.length,
          totalIncome: prevTotalIncome
        }
      });

      const result = {
        total: totalEvents,
        partlyPaid,
        fullyPaid,
        totalIncome,
        eventIncome,
        standaloneCustomerIncome,
        monthlyIncome,
        threeMonthIncome,
        dailyStats,
        events: allEvents || [],
        currentPeriod: {
          total: currTotal,
          partlyPaid: currPartlyPaid,
          fullyPaid: currFullyPaid,
          totalIncome: currTotalIncome
        },
        previousPeriod: {
          total: prevTotal,
          partlyPaid: prevPartlyPaid,
          fullyPaid: prevFullyPaid,
          totalIncome: prevTotalIncome
        }
      };

      console.log('🔧 Event stats result with booking requests included:', {
        dateRange: `${startDateStr} to ${endDateStr}`,
        total: result.total,
        partlyPaid: result.partlyPaid,
        fullyPaid: result.fullyPaid,
        totalIncome: result.totalIncome,
        eventIncome: result.eventIncome,
        standaloneCustomerIncome: result.standaloneCustomerIncome,
        regularEventsCount: regularEvents?.length || 0,
        bookingRequestsCount: bookingRequests?.length || 0,
        additionalPersonsCount: additionalPersons.length,
        recurringEventsCount: recurringEvents.length
      });

      return result;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    gcTime: 15 * 60 * 1000, // 15 minutes garbage collection
    refetchOnMount: false, // Performance: Don't refetch on mount if data is fresh
    refetchOnWindowFocus: false, // Performance: Don't refetch on window focus
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

      // CRITICAL: Match CRM page logic EXACTLY - events by start_date, customers by created_at
      // Get regular events in the date range (main persons) - filter by START_DATE (when event happens)
      const { data: regularEvents, error: regularEventsError } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', userId)
        .gte('start_date', startDateStr)
        .lte('start_date', endDateStr)
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

      // Get approved booking requests in the date range (main persons) - filter by START_DATE (when booking happens)
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
      // Match CRM page logic: filter by customer created_at, not event start_date
      const { data: crmCustomers, error: crmCustomersError } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'customer')
        .not('event_id', 'is', null)
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

      // Get standalone CRM customers (customers without events, added in date range)
      const { data: standaloneCrmCustomers, error: standaloneCrmError } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', userId)
        .is('event_id', null) // Not associated with events (primary filter)
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

      console.log('🔍 CUSTOMER COUNT DEBUG:', {
        regularEventsCount: regularEvents?.length || 0,
        bookingRequestsCount: bookingRequests?.length || 0,
        crmCustomersCount: crmCustomers?.length || 0,
        standaloneCrmCount: standaloneCrmCustomers?.length || 0,
        dateRange: `${startDateStr} to ${endDateStr}`
      });

      console.log('✅ FINAL CUSTOMER STATS:', {
        totalCustomers,
        withBooking,
        withoutBooking
      });

      // Calculate current and previous period for month-to-date comparison
      // Always compare current month (1st to today) vs previous month (1st to same day)
      const now = new Date();
      const currentDay = now.getDate();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      
      // Current period: 1st of current month to today
      const currentPeriodStart = new Date(currentYear, currentMonth, 1);
      const currentPeriodEnd = new Date(currentYear, currentMonth, currentDay, 23, 59, 59, 999);
      
      const currStartStr = currentPeriodStart.toISOString();
      const currEndStr = currentPeriodEnd.toISOString();

      // Fetch current period customers
      const { data: currCustEvents } = await supabase.from('events').select('id, social_network_link, user_number, user_surname').eq('user_id', userId).gte('start_date', currStartStr).lte('start_date', currEndStr).is('deleted_at', null).is('parent_event_id', null);
      const { data: currBookingReqs } = await supabase.from('booking_requests').select('requester_name, requester_phone, requester_email').eq('user_id', userId).eq('status', 'approved').gte('start_date', currStartStr).lte('start_date', currEndStr).is('deleted_at', null);
      
      // For customers linked to events, filter by event start_date not customer created_at
      const currEventIds = (currCustEvents || []).map(e => e.id);
      const { data: currCrmCustomers } = currEventIds.length > 0 
        ? await supabase.from('customers').select('social_network_link, user_number, user_surname, title').eq('user_id', userId).eq('type', 'customer').in('event_id', currEventIds).is('deleted_at', null)
        : { data: [] };
      
      const { data: currStandaloneCrm } = await supabase.from('customers').select('social_network_link, user_number, user_surname, title').eq('user_id', userId).is('event_id', null).gte('created_at', currStartStr).lte('created_at', currEndStr).is('deleted_at', null);
      
      const currCustSet = new Set<string>();
      currCustEvents?.forEach(e => currCustSet.add(`${e.social_network_link || 'no-email'}_${e.user_number || 'no-phone'}_${e.user_surname || 'no-name'}`));
      currBookingReqs?.forEach(b => currCustSet.add(`${b.requester_email || 'no-email'}_${b.requester_phone || 'no-phone'}_${b.requester_name || 'no-name'}`));
      currCrmCustomers?.forEach(c => currCustSet.add(`${c.social_network_link || 'no-email'}_${c.user_number || 'no-phone'}_${c.user_surname || c.title || 'no-name'}`));
      currStandaloneCrm?.forEach(c => currCustSet.add(`${c.social_network_link || 'no-email'}_${c.user_number || 'no-phone'}_${c.user_surname || c.title || 'no-name'}`));
      
      // Previous period: 1st of previous month to same day (or last day if previous month is shorter)
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const prevPeriodStart = new Date(prevYear, prevMonth, 1);
      
      // Get the last day of the previous month to handle edge cases
      const lastDayOfPrevMonth = new Date(prevYear, prevMonth + 1, 0).getDate();
      const prevDay = Math.min(currentDay, lastDayOfPrevMonth);
      const prevPeriodEnd = new Date(prevYear, prevMonth, prevDay, 23, 59, 59, 999);

      const prevStartStr = prevPeriodStart.toISOString();
      const prevEndStr = prevPeriodEnd.toISOString();

      // Fetch previous period customers
      const { data: prevCustEvents } = await supabase.from('events').select('id, social_network_link, user_number, user_surname').eq('user_id', userId).gte('start_date', prevStartStr).lte('start_date', prevEndStr).is('deleted_at', null).is('parent_event_id', null);
      const { data: prevBookingReqs } = await supabase.from('booking_requests').select('requester_name, requester_phone, requester_email').eq('user_id', userId).eq('status', 'approved').gte('start_date', prevStartStr).lte('start_date', prevEndStr).is('deleted_at', null);
      
      // For customers linked to events, filter by event start_date not customer created_at
      const prevEventIds = (prevCustEvents || []).map(e => e.id);
      const { data: prevCrmCustomers } = prevEventIds.length > 0
        ? await supabase.from('customers').select('social_network_link, user_number, user_surname, title').eq('user_id', userId).eq('type', 'customer').in('event_id', prevEventIds).is('deleted_at', null)
        : { data: [] };
      
      const { data: prevStandaloneCrm } = await supabase.from('customers').select('social_network_link, user_number, user_surname, title').eq('user_id', userId).is('event_id', null).gte('created_at', prevStartStr).lte('created_at', prevEndStr).is('deleted_at', null);
      
      const prevCustSet = new Set<string>();
      prevCustEvents?.forEach(e => prevCustSet.add(`${e.social_network_link || 'no-email'}_${e.user_number || 'no-phone'}_${e.user_surname || 'no-name'}`));
      prevBookingReqs?.forEach(b => prevCustSet.add(`${b.requester_email || 'no-email'}_${b.requester_phone || 'no-phone'}_${b.requester_name || 'no-name'}`));
      prevCrmCustomers?.forEach(c => prevCustSet.add(`${c.social_network_link || 'no-email'}_${c.user_number || 'no-phone'}_${c.user_surname || c.title || 'no-name'}`));
      prevStandaloneCrm?.forEach(c => prevCustSet.add(`${c.social_network_link || 'no-email'}_${c.user_number || 'no-phone'}_${c.user_surname || c.title || 'no-name'}`));

      console.log('📊 CUSTOMER STATS - Period Comparison Results:', {
        currentPeriod: {
          total: currCustSet.size,
          events: currCustEvents?.length,
          bookings: currBookingReqs?.length,
          crmCustomers: currCrmCustomers?.length,
          standalone: currStandaloneCrm?.length
        },
        previousPeriod: {
          total: prevCustSet.size,
          events: prevCustEvents?.length,
          bookings: prevBookingReqs?.length,
          crmCustomers: prevCrmCustomers?.length,
          standalone: prevStandaloneCrm?.length
        }
      });

      return {
        total: totalCustomers,
        withBooking,
        withoutBooking,
        currentPeriod: { total: currCustSet.size },
        previousPeriod: { total: prevCustSet.size }
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
