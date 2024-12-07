import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { CheckSquare, Clock, BanknoteIcon, CalendarIcon } from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from 'date-fns';
import { StatCard } from "./Statistics/StatCard";
import { BookingChart } from "./Statistics/BookingChart";
import { IncomeChart } from "./Statistics/IncomeChart";
import { DateRangeSelect } from "./Statistics/DateRangeSelect";
import { useState } from "react";

export const Statistics = () => {
  const { user } = useAuth();
  const [monthsRange, setMonthsRange] = useState(6);

  const { data: taskStats } = useQuery({
    queryKey: ['taskStats', user?.id],
    queryFn: async () => {
      const { data: tasks } = await supabase
        .from('tasks')
        .select('status')
        .eq('user_id', user?.id);

      return {
        total: tasks?.length || 0,
        completed: tasks?.filter(t => t.status === 'done').length || 0,
        inProgress: tasks?.filter(t => t.status === 'in-progress').length || 0,
        todo: tasks?.filter(t => t.status === 'todo').length || 0,
      };
    },
    enabled: !!user,
  });

  const { data: eventStats } = useQuery({
    queryKey: ['eventStats', user?.id, monthsRange],
    queryFn: async () => {
      const { data: events } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', user?.id);

      const lastMonths = eachMonthOfInterval({
        start: startOfMonth(subMonths(new Date(), monthsRange - 1)),
        end: endOfMonth(new Date())
      });

      const monthlyBookings = lastMonths.map(month => {
        const monthStart = startOfMonth(month);
        const monthEnd = endOfMonth(month);
        const monthEvents = events?.filter(event => {
          const eventDate = parseISO(event.start_date);
          return eventDate >= monthStart && eventDate <= monthEnd;
        });

        return {
          month: format(month, 'MMM yyyy'),
          bookings: monthEvents?.length || 0,
          income: monthEvents?.reduce((acc, event) => {
            if (event.payment_status === 'fully') {
              return acc + (event.payment_amount || 0);
            } else if (event.payment_status === 'partly') {
              return acc + (event.payment_amount || 0);
            }
            return acc;
          }, 0) || 0,
        };
      });

      return {
        total: events?.length || 0,
        meetings: events?.filter(e => e.type === 'meeting').length || 0,
        reminders: events?.filter(e => e.type === 'reminder').length || 0,
        monthlyStats: monthlyBookings,
        totalIncome: monthlyBookings.reduce((acc, month) => acc + month.income, 0),
      };
    },
    enabled: !!user,
  });

  const stats = [
    {
      title: "Total Tasks",
      value: taskStats?.total || 0,
      icon: CheckSquare,
      description: `${taskStats?.completed || 0} completed`,
    },
    {
      title: "Tasks In Progress",
      value: taskStats?.inProgress || 0,
      icon: Clock,
      description: `${taskStats?.todo || 0} todo`,
    },
    {
      title: "Total Events",
      value: eventStats?.total || 0,
      icon: CalendarIcon,
      description: `${eventStats?.meetings || 0} meetings`,
    },
    {
      title: "Total Income",
      value: `₾${eventStats?.totalIncome?.toFixed(2) || '0.00'}`,
      icon: BanknoteIcon,
      description: "From all events",
    },
  ];

  return (
    <div className="space-y-6">
      <DateRangeSelect 
        selectedRange={monthsRange}
        onRangeChange={setMonthsRange}
      />
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <StatCard key={index} {...stat} />
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <BookingChart data={eventStats?.monthlyStats || []} />
        <IncomeChart data={eventStats?.monthlyStats || []} />
      </div>
    </div>
  );
};