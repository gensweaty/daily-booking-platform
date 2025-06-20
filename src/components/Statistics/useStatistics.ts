
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

  // Helper function to consistently parse payment amounts
  const parsePaymentAmount = (amount: any): number => {
    // If null or undefined, return 0
    if (amount === null || amount === undefined) return 0;
    
    // Special handling for specific error cases
    if (amount === 'NaN' || amount === '') return 0;
    
    // For string values (might include currency symbols)
    if (typeof amount === 'string') {
      try {
        // Remove any non-numeric characters except dots and minus signs
        const cleanedStr = amount.replace(/[^0-9.-]+/g, '');
        const parsed = parseFloat(cleanedStr);
        return isNaN(parsed) ? 0 : parsed;
      } catch (e) {
        console.error(`Failed to parse string payment amount: ${amount}`, e);
        return 0;
      }
    }
    
    // For numeric values, ensure they're valid
    if (typeof amount === 'number') {
      return isNaN(amount) ? 0 : amount;
    }
    
    // Try to convert other types to number
    try {
      const converted = Number(amount);
      return isNaN(converted) ? 0 : converted;
    } catch (e) {
      console.error(`Failed to convert payment amount: ${amount}`, e);
      return 0;
    }
  };

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
      
      // Get all calendar events - IMPORTANT: Now explicitly filtering out deleted events
      const { data: calendarEvents, error: calendarError } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', userId)
        .gte('start_date', startDateStr)
        .lte('start_date', endDateStr)
        .is('deleted_at', null); // This ensures we only count non-deleted events

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
        .is('deleted_at', null); // Also ensure we only count non-deleted CRM events
        
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
      
      // Log detailed payment information for each event with payment data
      console.log('Event payment data:');
      allEvents.forEach((event, index) => {
        if (event.payment_amount !== undefined && event.payment_amount !== null) {
          console.log(`Event ${index + 1} (${event.id}):`, {
            title: event.title,
            raw_payment_amount: event.payment_amount,
            type_of: typeof event.payment_amount,
            payment_status: event.payment_status,
            parsed_amount: parsePaymentAmount(event.payment_amount)
          });
        }
      });

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

      // NEW LOGIC: Monthly income should ALWAYS show 3 months (current + past 2) for the income chart
      // while other statistics respect the selected date range
      const currentDate = new Date();
      const isDefaultDateRange = 
        format(dateRange.start, 'yyyy-MM-dd') === format(startOfMonth(currentDate), 'yyyy-MM-dd') &&
        format(dateRange.end, 'yyyy-MM-dd') === format(endOfMonth(currentDate), 'yyyy-MM-dd');

      // For monthly income, we need to fetch events from a wider range to get 3 months of data
      const incomeRangeStart = addMonths(startOfMonth(currentDate), -2);
      const incomeRangeEnd = endOfDay(endOfMonth(currentDate));
      
      // Fetch additional events for income calculation if needed
      let allEventsForIncome = allEvents;
      
      if (isDefaultDateRange) {
        // We need to fetch events from the wider range for income calculation
        const { data: additionalCalendarEvents } = await supabase
          .from('events')
          .select('*')
          .eq('user_id', userId)
          .gte('start_date', incomeRangeStart.toISOString())
          .lte('start_date', incomeRangeEnd.toISOString())
          .is('deleted_at', null);

        const { data: additionalCrmEvents } = await supabase
          .from('customers')
          .select('*')
          .eq('user_id', userId)
          .eq('create_event', true)
          .gte('start_date', incomeRangeStart.toISOString())
          .lte('start_date', incomeRangeEnd.toISOString())
          .is('deleted_at', null);

        // Combine additional events for income calculation
        const additionalEventsMap = new Map();
        
        additionalCalendarEvents?.forEach(event => {
          const key = `${event.start_date}-${event.end_date}-${event.title}`;
          additionalEventsMap.set(key, {
            ...event,
            payment_status: normalizePaymentStatus(event.payment_status)
          });
        });
        
        additionalCrmEvents?.forEach(event => {
          const key = `${event.start_date}-${event.end_date}-${event.title}`;
          if (!additionalEventsMap.has(key)) {
            additionalEventsMap.set(key, {
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
            });
          }
        });
        
        allEventsForIncome = Array.from(additionalEventsMap.values());
      }

      // Calculate monthly income - always show 3 months for the chart
      const monthsForIncome = [
        addMonths(startOfMonth(currentDate), -2),
        addMonths(startOfMonth(currentDate), -1),
        startOfMonth(currentDate)
      ];
      
      const monthlyIncome = monthsForIncome.map(month => {
        const monthStart = startOfMonth(month);
        const monthEnd = endOfDay(endOfMonth(month));
        
        // Filter events within this month from the income events
        const monthEvents = allEventsForIncome.filter(event => {
          if (!event.start_date) return false;
          const eventDate = parseISO(event.start_date);
          return eventDate >= monthStart && eventDate <= monthEnd;
        });
        
        // Calculate income from events with valid payment status
        let income = 0;
        
        monthEvents.forEach(event => {
          const status = normalizePaymentStatus(event.payment_status);
          const isPaid = status === 'fully_paid' || status === 'partly_paid';
          
          if (isPaid && (event.payment_amount !== undefined && event.payment_amount !== null)) {
            const parsedAmount = parsePaymentAmount(event.payment_amount);
            income += parsedAmount;
            console.log(`Month ${format(month, 'MMM yyyy')} - Added ${parsedAmount} from event ${event.id}`);
          }
        });
        
        return {
          month: format(month, 'MMM yyyy'),
          income: income,
        };
      });
      
      // Debug: Monthly income data
      console.log('Monthly income data:', monthlyIncome);

      // Calculate total income directly from all events with consistent parsing
      let totalIncome = 0;
      let validPaymentCount = 0;
      
      allEvents.forEach(event => {
        const status = normalizePaymentStatus(event.payment_status);
        const isPaid = status === 'fully_paid' || status === 'partly_paid';
                       
        if (isPaid && (event.payment_amount !== undefined && event.payment_amount !== null)) {
          const parsedAmount = parsePaymentAmount(event.payment_amount);
          
          if (parsedAmount > 0) {
            validPaymentCount++;
            console.log(`Total income: Adding ${parsedAmount} from event ${event.id} (${event.title})`);
            totalIncome += parsedAmount;
          }
        }
      });
      
      // Double check by calculating total from current month only (for totalIncome display)
      const currentMonthEvents = allEvents.filter(event => {
        if (!event.start_date) return false;
        const eventDate = parseISO(event.start_date);
        const currentMonthStart = startOfMonth(currentDate);
        const currentMonthEnd = endOfDay(endOfMonth(currentDate));
        return eventDate >= currentMonthStart && eventDate <= currentMonthEnd;
      });
      
      let currentMonthIncome = 0;
      currentMonthEvents.forEach(event => {
        const status = normalizePaymentStatus(event.payment_status);
        const isPaid = status === 'fully_paid' || status === 'partly_paid';
                       
        if (isPaid && (event.payment_amount !== undefined && event.payment_amount !== null)) {
          const parsedAmount = parsePaymentAmount(event.payment_amount);
          if (parsedAmount > 0) {
            currentMonthIncome += parsedAmount;
          }
        }
      });
      
      // Use current month income for totalIncome display if we're in default view
      if (isDefaultDateRange) {
        totalIncome = currentMonthIncome;
      }
      
      console.log('Income calculation summary:', {
        totalDirectCalculation: totalIncome,
        currentMonthIncome,
        eventsWithValidPayment: validPaymentCount,
        totalEventCount: allEvents.length,
        isDefaultView: isDefaultDateRange
      });

      // Final validation to ensure totalIncome is a valid number
      if (typeof totalIncome !== 'number' || isNaN(totalIncome)) {
        console.error('Invalid totalIncome detected, resetting to 0:', totalIncome);
        totalIncome = 0;
      }

      console.log(`Final totalIncome value: ${totalIncome}`);

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
