
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

  // Optimize events stats query with more efficient date handling
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
      
      const { data: events, error } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', userId)
        .gte('start_date', startDateStr)
        .lte('start_date', endDateStr)
        .is('deleted_at', null);

      if (error) {
        console.error('Error fetching event stats:', error);
        throw error;
      }

      // Get payment status counts - Fix: use 'partly_paid' and 'fully_paid' as database values
      // Also handle 'partly' and 'fully' formats for compatibility
      const partlyPaid = events?.filter(e => 
        e.payment_status === 'partly_paid' || e.payment_status === 'partly'
      ).length || 0;
      
      const fullyPaid = events?.filter(e => 
        e.payment_status === 'fully_paid' || e.payment_status === 'fully'
      ).length || 0;

      // Get all days in the selected range for daily bookings
      const daysInRange = eachDayOfInterval({
        start: dateRange.start,
        end: dateRange.end
      });

      const dailyBookings = daysInRange.map(day => {
        const dayEvents = events?.filter(event => {
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

      // Fetch monthly data in a more efficient way
      const monthlyIncome = await Promise.all(monthsToCompare.map(async (month) => {
        const monthStart = startOfMonth(month);
        const monthEnd = endOfMonth(month);
        
        const { data: monthEvents, error: monthError } = await supabase
          .from('events')
          .select('payment_status,payment_amount')  // Only select needed fields
          .eq('user_id', userId)
          .gte('start_date', monthStart.toISOString())
          .lte('start_date', endOfDay(monthEnd).toISOString())
          .is('deleted_at', null);

        if (monthError) {
          console.error('Error fetching monthly income:', monthError);
          return {
            month: format(month, 'MMM yyyy'),
            income: 0,
          };
        }

        // Fix: calculate income from events with partly_paid/fully_paid or partly/fully
        return {
          month: format(month, 'MMM yyyy'),
          income: monthEvents?.reduce((acc, event) => {
            const isPaid = event.payment_status === 'fully_paid' || 
                           event.payment_status === 'partly_paid' ||
                           event.payment_status === 'fully' ||
                           event.payment_status === 'partly';
                           
            if (isPaid && event.payment_amount) {
              return acc + Number(event.payment_amount);
            }
            return acc;
          }, 0) || 0,
        };
      }));

      // Fix: calculate total income correctly considering both payment status formats
      const totalIncome = events?.reduce((acc, event) => {
        const isPaid = event.payment_status === 'fully_paid' || 
                       event.payment_status === 'partly_paid' ||
                       event.payment_status === 'fully' ||
                       event.payment_status === 'partly';
                       
        if (isPaid && event.payment_amount) {
          return acc + Number(event.payment_amount);
        }
        return acc;
      }, 0) || 0;

      return {
        total: events?.length || 0,
        partlyPaid,
        fullyPaid,
        dailyStats: dailyBookings,
        monthlyIncome,
        totalIncome,
        events: events || [],
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
