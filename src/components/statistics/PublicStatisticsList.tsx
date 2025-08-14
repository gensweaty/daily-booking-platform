import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { PresenceAvatars } from "@/components/PresenceAvatars";
import { useLanguage } from "@/contexts/LanguageContext";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { BookingChart } from "@/components/Statistics/BookingChart";
import { IncomeChart } from "@/components/Statistics/IncomeChart";
import { StatsHeader } from "@/components/Statistics/StatsHeader";
import { StatsCards } from "@/components/Statistics/StatsCards";
import { startOfMonth, endOfMonth } from 'date-fns';

interface PublicStatisticsListProps {
  boardUserId: string;
  externalUserName: string;
  externalUserEmail: string;
  onlineUsers: { name: string; email: string }[];
}

export const PublicStatisticsList = ({ 
  boardUserId, 
  externalUserName, 
  externalUserEmail, 
  onlineUsers 
}: PublicStatisticsListProps) => {
  const queryClient = useQueryClient();
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';
  
  const currentDate = useMemo(() => new Date(), []);
  const [dateRange, setDateRange] = useState({ 
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate)
  });

  // Fetch task statistics
  const { data: taskStats, isLoading: isLoadingTasks } = useQuery({
    queryKey: ['publicTaskStats', boardUserId],
    queryFn: async () => {
      console.log('Fetching public task stats for user:', boardUserId);
      const { data, error } = await supabase
        .rpc('get_task_stats', { user_id_param: boardUserId });
      
      if (error) {
        console.error('Error fetching public task stats:', error);
        throw error;
      }
      
      console.log('Fetched task stats:', data);
      return data?.[0] || { total: 0, completed: 0, in_progress: 0, todo: 0 };
    },
    enabled: !!boardUserId,
    refetchInterval: false,
  });

  // Fetch event statistics
  const { data: eventStats, isLoading: isLoadingEvents } = useQuery({
    queryKey: ['publicEventStats', boardUserId, dateRange],
    queryFn: async () => {
      console.log('Fetching public event stats for user:', boardUserId, 'dateRange:', dateRange);
      
      const { data: events, error } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', boardUserId)
        .is('deleted_at', null)
        .gte('start_date', dateRange.start.toISOString())
        .lte('start_date', dateRange.end.toISOString());
      
      if (error) {
        console.error('Error fetching public event stats:', error);
        throw error;
      }
      
      // Process event statistics
      const total = events?.length || 0;
      const partlyPaid = events?.filter(e => e.payment_status === 'partly_paid').length || 0;
      const fullyPaid = events?.filter(e => e.payment_status === 'fully_paid').length || 0;
      const totalIncome = events?.reduce((sum, e) => sum + (parseFloat(e.payment_amount) || 0), 0) || 0;
      
      console.log('Processed event stats:', { total, partlyPaid, fullyPaid, totalIncome });
      return {
        total,
        partlyPaid,
        fullyPaid,
        totalIncome,
        dailyStats: [],
        monthlyIncome: []
      };
    },
    enabled: !!boardUserId,
    refetchInterval: false,
  });

  // Fetch customer statistics
  const { data: customerStats, isLoading: isLoadingCustomers } = useQuery({
    queryKey: ['publicCustomerStats', boardUserId],
    queryFn: async () => {
      console.log('Fetching public customer stats for user:', boardUserId);
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', boardUserId)
        .is('deleted_at', null);
      
      if (error) {
        console.error('Error fetching public customer stats:', error);
        throw error;
      }
      
      const total = data?.length || 0;
      const withBooking = data?.filter(c => c.event_id).length || 0;
      const withoutBooking = total - withBooking;
      
      console.log('Processed customer stats:', { total, withBooking, withoutBooking });
      return {
        total,
        withBooking,
        withoutBooking
      };
    },
    enabled: !!boardUserId,
    refetchInterval: false,
  });

  const isLoading = isLoadingTasks || isLoadingEvents || isLoadingCustomers;

  // Set up real-time subscriptions for statistics changes
  useEffect(() => {
    if (!boardUserId) return;

    console.log('Setting up real-time subscription for statistics:', boardUserId);
    
    const tasksChannel = supabase
      .channel('public_stats_tasks')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `user_id=eq.${boardUserId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['publicTaskStats', boardUserId] });
        }
      )
      .subscribe();

    const eventsChannel = supabase
      .channel('public_stats_events')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events',
          filter: `user_id=eq.${boardUserId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['publicEventStats', boardUserId, dateRange] });
        }
      )
      .subscribe();

    const customersChannel = supabase
      .channel('public_stats_customers')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'customers',
          filter: `user_id=eq.${boardUserId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['publicCustomerStats', boardUserId] });
        }
      )
      .subscribe();

    return () => {
      console.log('Cleaning up real-time statistics subscriptions');
      supabase.removeChannel(tasksChannel);
      supabase.removeChannel(eventsChannel);
      supabase.removeChannel(customersChannel);
    };
  }, [boardUserId, queryClient, dateRange]);

  const handleDateChange = (start: Date, end: Date | null) => {
    console.log("Public stats date range changed to:", { start, end: end || start });
    setDateRange({ start, end: end || start });
  };

  const handleExport = () => {
    console.log("Export functionality not available in public view");
  };

  // Default stats
  const defaultTaskStats = { total: 0, completed: 0, inProgress: 0, todo: 0 };
  const defaultEventStats = { total: 0, partlyPaid: 0, fullyPaid: 0, totalIncome: 0, monthlyIncome: [], dailyStats: [] };
  const defaultCustomerStats = { total: 0, withBooking: 0, withoutBooking: 0 };

  const currentTaskStats = taskStats || defaultTaskStats;
  const currentEventStats = eventStats || defaultEventStats;
  const currentCustomerStats = customerStats || defaultCustomerStats;

  // Loading skeleton
  if (isLoading) {
    return (
      <motion.div 
        className="space-y-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* Header skeleton */}
        <div className="flex flex-row items-center justify-between gap-4">
          <div className="w-32 h-8 bg-muted rounded animate-pulse" />
          <div className="flex items-center gap-3">
            <div className="w-20 h-8 bg-muted rounded animate-pulse" />
          </div>
        </div>
        
        {/* Statistics content skeleton */}
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-[300px] w-full" />
            <Skeleton className="h-[300px] w-full" />
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Mobile: Header line with Statistics left, circles center */}
      <div className="grid sm:hidden grid-cols-[auto_1fr] items-center w-full">
        <h2 className="text-2xl font-bold text-foreground">{t('dashboard.statistics')}</h2>
        <div className="flex items-center justify-center">
          <PresenceAvatars users={onlineUsers} currentUserEmail={externalUserEmail} max={5} />
        </div>
      </div>

      {/* Desktop: Header with presence left aligned */}
      <div className="hidden sm:flex flex-row items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-foreground">{t('dashboard.statistics')}</h2>
        <div className="flex items-center gap-3">
          <PresenceAvatars users={onlineUsers} currentUserEmail={externalUserEmail} max={5} />
        </div>
      </div>

      <StatsHeader 
        dateRange={dateRange}
        onDateChange={handleDateChange}
        onExport={handleExport}
        isLoading={isLoading}
      />
      
      <StatsCards 
        taskStats={currentTaskStats} 
        eventStats={currentEventStats}
        customerStats={currentCustomerStats}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <BookingChart data={currentEventStats.dailyStats} />
        <IncomeChart data={currentEventStats.monthlyIncome} />
      </div>
    </div>
  );
};