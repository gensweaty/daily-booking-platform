import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import {
  BarChart as BarChartIcon,
  Calendar as CalendarIcon,
  CheckSquare,
  Clock
} from "lucide-react";

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
        .select('type')
        .eq('user_id', user?.id);

      return {
        total: events?.length || 0,
        meetings: events?.filter(e => e.type === 'meeting').length || 0,
        reminders: events?.filter(e => e.type === 'reminder').length || 0,
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
      title: "Reminders",
      value: eventStats?.reminders || 0,
      icon: BarChartIcon,
      description: "Active reminders",
    },
  ];

  return (
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
  );
};