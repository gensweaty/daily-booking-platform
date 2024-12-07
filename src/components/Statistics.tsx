import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import {
  BarChart as BarChartIcon,
  Calendar as CalendarIcon,
  CheckSquare,
  Clock,
  BanknoteIcon,
  TrendingUp
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import { format, parseISO, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from 'date-fns';

export const Statistics = () => {
  const { user } = useAuth();

  const { data: taskStats } = useQuery({
    queryKey: ['taskStats', user?.id],
    queryFn: async () => {
      const { data: tasks } = await supabase
        .from('tasks')
        .select('status')
        .eq('user_id', user?.id);

      const stats = {
        total: tasks?.length || 0,
        completed: tasks?.filter(t => t.status === 'done').length || 0,
        inProgress: tasks?.filter(t => t.status === 'in-progress').length || 0,
        todo: tasks?.filter(t => t.status === 'todo').length || 0,
      };

      return stats;
    },
    enabled: !!user,
  });

  const { data: eventStats } = useQuery({
    queryKey: ['eventStats', user?.id],
    queryFn: async () => {
      const { data: events } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', user?.id);

      // Calculate monthly bookings
      const last6Months = eachMonthOfInterval({
        start: startOfMonth(subMonths(new Date(), 5)),
        end: endOfMonth(new Date())
      });

      const monthlyBookings = last6Months.map(month => {
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

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border border-border p-2 rounded-lg shadow-lg">
          <p className="text-sm font-medium">{label}</p>
          {payload.map((pld: any, index: number) => (
            <p key={index} className="text-sm">
              {pld.name === "Income (₾)" ? 
                `${pld.name}: ₾${pld.value.toFixed(2)}` :
                `${pld.name}: ${pld.value}`
              }
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="p-4 flex flex-col space-y-2">
              <div className="flex items-center space-x-2">
                <Icon className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">{stat.title}</h3>
              </div>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Booking Dynamics
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={eventStats?.monthlyStats || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="bookings"
                  stroke="#8884d8"
                  name="Bookings"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
            <BanknoteIcon className="w-4 h-4" />
            Monthly Income
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={eventStats?.monthlyStats || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar
                  dataKey="income"
                  fill="#82ca9d"
                  name="Income (₾)"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
};