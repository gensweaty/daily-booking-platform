
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { format, parseISO, eachDayOfInterval, endOfDay, startOfMonth, endOfMonth, differenceInMonths, addMonths, eachMonthOfInterval } from 'date-fns';

export const useStatistics = (userId: string | undefined, dateRange: { start: Date; end: Date }) => {
  const { data: taskStats } = useQuery({
    queryKey: ['taskStats', userId],
    queryFn: async () => {
      const { data: tasks } = await supabase
        .from('tasks')
        .select('status')
        .eq('user_id', userId);

      return {
        total: tasks?.length || 0,
        completed: tasks?.filter(t => t.status === 'done').length || 0,
        inProgress: tasks?.filter(t => t.status === 'in-progress').length || 0,
        todo: tasks?.filter(t => t.status === 'todo').length || 0,
      };
    },
    enabled: !!userId,
  });

  const { data: eventStats } = useQuery({
    queryKey: ['eventStats', userId, dateRange.start, dateRange.end],
    queryFn: async () => {
      const { data: events } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', userId)
        .gte('start_date', dateRange.start.toISOString())
        .lte('start_date', endOfDay(dateRange.end).toISOString());

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
        
        const { data: monthEvents } = await supabase
          .from('events')
          .select('*')
          .eq('user_id', userId)
          .gte('start_date', monthStart.toISOString())
          .lte('start_date', endOfDay(monthEnd).toISOString());

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
  });

  return { taskStats, eventStats };
};
