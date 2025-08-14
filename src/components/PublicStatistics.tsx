import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarIcon, Users, CheckCircle, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { startOfMonth, endOfMonth } from "date-fns";

interface PublicStatisticsProps {
  boardUserId: string;
}

export const PublicStatistics = ({ boardUserId }: PublicStatisticsProps) => {
  const currentDate = new Date();
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['publicStatistics', boardUserId],
    queryFn: async () => {
      // Get tasks stats
      const { data: tasks } = await supabase
        .from('tasks')
        .select('status')
        .eq('user_id', boardUserId)
        .eq('archived', false);

      // Get events stats
      const { data: events } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', boardUserId)
        .gte('start_time', monthStart.toISOString())
        .lte('end_time', monthEnd.toISOString());

      // Get customers stats
      const { data: customers } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', boardUserId);

      const completedTasks = tasks?.filter(t => t.status === 'done').length || 0;
      const totalTasks = tasks?.length || 0;
      const totalEvents = events?.length || 0;
      const totalCustomers = customers?.length || 0;

      return {
        completedTasks,
        totalTasks,
        totalEvents,
        totalCustomers
      };
    },
    enabled: !!boardUserId,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  const statCards = [
    {
      title: "Total Tasks",
      value: stats?.totalTasks || 0,
      icon: CheckCircle,
      description: "All tasks created"
    },
    {
      title: "Completed Tasks",
      value: stats?.completedTasks || 0,
      icon: TrendingUp,
      description: "Tasks finished"
    },
    {
      title: "Events This Month",
      value: stats?.totalEvents || 0,
      icon: CalendarIcon,
      description: "Calendar events"
    },
    {
      title: "Total Customers",
      value: stats?.totalCustomers || 0,
      icon: Users,
      description: "CRM contacts"
    }
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {card.title}
              </CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground">
                {card.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle>Task Completion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {stats.totalTasks > 0 
                ? Math.round((stats.completedTasks / stats.totalTasks) * 100)
                : 0}%
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {stats.completedTasks} of {stats.totalTasks} tasks completed
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};