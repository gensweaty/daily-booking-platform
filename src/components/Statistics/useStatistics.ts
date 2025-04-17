
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { format, parseISO, eachDayOfInterval, endOfDay, startOfMonth, endOfMonth, differenceInMonths, addMonths, eachMonthOfInterval } from 'date-fns';

export const useStatistics = (userId: string | undefined, dateRange: { start: Date; end: Date }) => {
  const { data: taskStats, isLoading: isLoadingTaskStats } = useQuery({
    queryKey: ['taskStats', userId],
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

  const { data: eventStats, isLoading: isLoadingEventStats } = useQuery({
    queryKey: ['eventStats', userId, dateRange.start.toISOString(), dateRange.end.toISOString()],
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
      
      const { data: events, error } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', userId)
        .gte('start_date', dateRange.start.toISOString())
        .lte('start_date', endOfDay(dateRange.end).toISOString())
        .is('deleted_at', null);

      if (error) {
        console.error('Error fetching event stats:', error);
        throw error;
      }

      // Get payment status counts
      const partlyPaid = events?.filter(e => e.payment_status === 'partly').length || 0;
      const fullyPaid = events?.filter(e => e.payment_status === 'fully').length || 0;

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

      // Get months for income comparison
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

      const monthlyIncome = await Promise.all(monthsToCompare.map(async (month) => {
        const monthStart = startOfMonth(month);
        const monthEnd = endOfMonth(month);
        
        const { data: monthEvents, error: monthError } = await supabase
          .from('events')
          .select('*')
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

        return {
          month: format(month, 'MMM yyyy'),
          income: monthEvents?.reduce((acc, event) => {
            if (event.payment_status === 'fully' || event.payment_status === 'partly') {
              return acc + (event.payment_amount || 0);
            }
            return acc;
          }, 0) || 0,
        };
      }));

      const totalIncome = events?.reduce((acc, event) => {
        if (event.payment_status === 'fully' || event.payment_status === 'partly') {
          return acc + (event.payment_amount || 0);
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
