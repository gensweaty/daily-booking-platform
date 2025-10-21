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
import { useExcelExport } from "@/components/Statistics/ExcelExport";
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';

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
  const { exportToExcel } = useExcelExport();
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
      
      // Use direct query instead of RPC to match internal dashboard logic
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select('status')
        .eq('user_id', boardUserId)
        .eq('archived', false)
        .is('archived_at', null);

      if (error) {
        console.error('Error fetching public task stats:', error);
        throw error;
      }

      const completed = tasks?.filter(t => t.status === 'done').length || 0;
      const inProgress = tasks?.filter(t => t.status === 'inprogress').length || 0;
      const todo = tasks?.filter(t => t.status === 'todo').length || 0;

      const stats = {
        total: completed + inProgress + todo,
        completed,
        inProgress, // camelCase to match StatsCards interface
        todo
      };

      console.log('Public task stats calculated:', stats);
      return stats;
    },
    enabled: !!boardUserId,
    refetchInterval: false,
  });

  // Fetch event statistics with chart data (matching internal dashboard logic)
  const { data: eventStats, isLoading: isLoadingEvents } = useQuery({
    queryKey: ['publicEventStats', boardUserId, dateRange],
    queryFn: async () => {
      console.log('Fetching public event stats for user:', boardUserId, 'dateRange:', dateRange);
      
      const startDateStr = dateRange.start.toISOString();
      const endDateStr = dateRange.end.toISOString();
      
      // Get regular events in the date range
      const { data: events, error } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', boardUserId)
        .is('deleted_at', null)
        .gte('start_date', startDateStr)
        .lte('start_date', endDateStr);
      
      if (error) {
        console.error('Error fetching public event stats:', error);
        throw error;
      }

      // Get approved booking requests
      const { data: bookingRequests, error: bookingError } = await supabase
        .from('booking_requests')
        .select('*')
        .eq('user_id', boardUserId)
        .eq('status', 'approved')
        .gte('start_date', startDateStr)
        .lte('start_date', endDateStr)
        .is('deleted_at', null);

      if (bookingError) {
        console.error('Error fetching booking requests:', bookingError);
      }

      // Combine events and booking requests
      const allEvents = [
        ...(events || []),
        ...(bookingRequests || []).map(booking => ({
          ...booking,
          is_recurring: false,
          parent_event_id: null,
          type: 'booking_request'
        }))
      ];
      
      // Get additional persons (customers) for parent events
      const parentEventIds = events
        ?.filter(event => !event.parent_event_id)
        .map(event => event.id) || [];

      let additionalPersons: any[] = [];
      if (parentEventIds.length > 0) {
        const { data: customers, error: customersError } = await supabase
          .from('customers')
          .select('*')
          .in('event_id', parentEventIds)
          .eq('type', 'customer')
          .is('deleted_at', null);

        if (!customersError && customers) {
          additionalPersons = customers;
        }
      }

      // Separate recurring series for proper calculation
      const recurringSeriesMap = new Map<string, any[]>();
      const nonRecurringEvents: any[] = [];

      allEvents.forEach(event => {
        if (event.is_recurring && event.parent_event_id) {
          const parentId = event.parent_event_id;
          if (!recurringSeriesMap.has(parentId)) {
            recurringSeriesMap.set(parentId, []);
          }
          recurringSeriesMap.get(parentId)?.push(event);
        } else if (event.is_recurring && !event.parent_event_id) {
          if (!recurringSeriesMap.has(event.id)) {
            recurringSeriesMap.set(event.id, []);
          }
          recurringSeriesMap.get(event.id)?.push(event);
        } else {
          nonRecurringEvents.push(event);
        }
      });

      // Calculate statistics
      const total = allEvents.length;
      let partlyPaid = 0;
      let fullyPaid = 0;
      let eventIncome = 0;

      const dailyBookings = new Map<string, number>();
      const monthlyIncomeMap = new Map<string, number>();

      // Process non-recurring events
      nonRecurringEvents.forEach(event => {
        const paymentStatus = event.payment_status || '';
        if (paymentStatus.includes('partly')) partlyPaid++;
        if (paymentStatus.includes('fully')) fullyPaid++;

        // Calculate income from main event
        if ((paymentStatus.includes('partly') || paymentStatus.includes('fully')) && event.payment_amount) {
          const amount = typeof event.payment_amount === 'number' 
            ? event.payment_amount 
            : parseFloat(String(event.payment_amount));
          if (!isNaN(amount) && amount > 0) {
            eventIncome += amount;
          }
        }

        // Daily stats
        if (event.start_date) {
          const eventDate = new Date(event.start_date);
          const day = eventDate.toISOString().split('T')[0];
          dailyBookings.set(day, (dailyBookings.get(day) || 0) + 1);
        }
      });

      // Process recurring series (count payment once per series)
      for (const [seriesId, seriesEvents] of recurringSeriesMap) {
        let hasPartlyPaid = false;
        let hasFullyPaid = false;
        
        const firstInstance = seriesEvents[0];
        
        seriesEvents.forEach(instance => {
          const paymentStatus = instance.payment_status || '';
          if (paymentStatus.includes('partly')) hasPartlyPaid = true;
          if (paymentStatus.includes('fully')) hasFullyPaid = true;

          // Count each instance for daily stats
          if (instance.start_date) {
            const eventDate = new Date(instance.start_date);
            const day = eventDate.toISOString().split('T')[0];
            dailyBookings.set(day, (dailyBookings.get(day) || 0) + 1);
          }
        });

        if (hasPartlyPaid && !hasFullyPaid) partlyPaid++;
        if (hasFullyPaid) fullyPaid++;

        // Add income only once per series
        if ((firstInstance.payment_status?.includes('partly') || 
             firstInstance.payment_status?.includes('fully')) && 
            firstInstance.payment_amount) {
          const amount = typeof firstInstance.payment_amount === 'number' 
            ? firstInstance.payment_amount 
            : parseFloat(String(firstInstance.payment_amount));
          if (!isNaN(amount) && amount > 0) {
            eventIncome += amount;
          }
        }

        // Add income from additional persons for this series (once per person)
        const seriesAdditionalPersons = additionalPersons.filter(person => 
          person.event_id === seriesId
        );

        seriesAdditionalPersons.forEach(person => {
          const personPaymentStatus = person.payment_status || '';
          if ((personPaymentStatus.includes('partly') || personPaymentStatus.includes('fully')) && person.payment_amount) {
            const amount = typeof person.payment_amount === 'number' 
              ? person.payment_amount 
              : parseFloat(String(person.payment_amount));
            if (!isNaN(amount) && amount > 0) {
              eventIncome += amount;
            }
          }
        });
      }

      // Add income from additional persons for non-recurring events
      const nonRecurringAdditionalPersons = additionalPersons.filter(person => 
        !recurringSeriesMap.has(person.event_id || '')
      );

      nonRecurringAdditionalPersons.forEach(person => {
        const personPaymentStatus = person.payment_status || '';
        if ((personPaymentStatus.includes('partly') || personPaymentStatus.includes('fully')) && person.payment_amount) {
          const amount = typeof person.payment_amount === 'number' 
            ? person.payment_amount 
            : parseFloat(String(person.payment_amount));
          if (!isNaN(amount) && amount > 0) {
            eventIncome += amount;
          }
        }
      });

      // Get standalone customers income (customers without events)
      const { data: standaloneCustomers, error: standaloneError } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', boardUserId)
        .is('event_id', null)
        .gte('created_at', startDateStr)
        .lte('created_at', endDateStr)
        .is('deleted_at', null);

      let standaloneCustomerIncome = 0;
      if (!standaloneError && standaloneCustomers) {
        standaloneCustomers.forEach(customer => {
          const paymentStatus = customer.payment_status || '';
          if ((paymentStatus.includes('partly') || paymentStatus.includes('fully')) && customer.payment_amount) {
            const amount = typeof customer.payment_amount === 'number' 
              ? customer.payment_amount 
              : parseFloat(String(customer.payment_amount));
            if (!isNaN(amount) && amount > 0) {
              standaloneCustomerIncome += amount;
            }
          }
        });
      }

      const totalIncome = eventIncome + standaloneCustomerIncome;

      // Convert daily bookings to array
      const dailyStats = Array.from(dailyBookings.entries()).map(([day, bookings]) => {
        const date = new Date(day);
        return {
          day: date.getDate().toString(),
          bookings,
          date,
          month: date.toLocaleDateString('en-US', { month: 'short' })
        };
      }).sort((a, b) => a.date.getTime() - b.date.getTime());
      
      console.log('Public event stats calculated:', { 
        total, 
        partlyPaid, 
        fullyPaid, 
        eventIncome,
        standaloneCustomerIncome,
        totalIncome,
        dailyStatsCount: dailyStats.length
      });
      
      return {
        total,
        partlyPaid,
        fullyPaid,
        totalIncome,
        eventIncome,
        standaloneCustomerIncome,
        dailyStats,
        monthlyIncome: [], // Will be filled by 3-month query
        events: allEvents || []
      };
    },
    enabled: !!boardUserId,
    refetchInterval: false,
  });

  // Fetch 3-month income comparison with standalone customers (matching internal dashboard logic)
  const { data: threeMonthIncome } = useQuery({
    queryKey: ['publicThreeMonthIncome', boardUserId],
    queryFn: async () => {
      console.log('Fetching 3-month income comparison for user:', boardUserId);
      const today = new Date();
      const threeMonthData: Array<{ month: string; income: number; eventIncome: number; customerIncome: number }> = [];

      // Calculate for each of the last 3 months
      for (let i = 0; i < 3; i++) {
        const monthDate = subMonths(today, 2 - i);
        const monthStart = startOfMonth(monthDate);
        const monthEnd = endOfMonth(monthDate);
        const monthShort = format(monthDate, 'MMM');

        let monthEventIncome = 0;
        let monthCustomerIncome = 0;

        // Query events for this specific month
        const { data: monthEvents } = await supabase
          .from('events')
          .select('*')
          .eq('user_id', boardUserId)
          .gte('start_date', monthStart.toISOString())
          .lte('start_date', monthEnd.toISOString())
          .is('deleted_at', null);

        // Query booking requests for this specific month
        const { data: monthBookingRequests } = await supabase
          .from('booking_requests')
          .select('*')
          .eq('user_id', boardUserId)
          .gte('start_date', monthStart.toISOString())
          .lte('start_date', monthEnd.toISOString())
          .eq('status', 'approved')
          .is('deleted_at', null);

        if (monthEvents) {
          // Transform booking requests to look like events
          const transformedMonthBookings = (monthBookingRequests || []).map((booking: any) => ({
            ...booking,
            is_recurring: false,
            parent_event_id: null,
            type: 'booking_request'
          }));

          const allMonthEvents = [...monthEvents, ...transformedMonthBookings];

          // Separate recurring series and non-recurring events
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

          // Process non-recurring events
          monthNonRecurringEvents.forEach(event => {
            if ((event.payment_status?.includes('partly') || event.payment_status?.includes('fully')) && event.payment_amount) {
              const amount = typeof event.payment_amount === 'number' 
                ? event.payment_amount 
                : parseFloat(String(event.payment_amount));
              if (!isNaN(amount) && amount > 0) {
                monthEventIncome += amount;
              }
            }
          });

          // Process recurring series (count once per series)
          for (const [seriesId, seriesEvents] of monthRecurringSeriesMap) {
            const firstInstance = seriesEvents[0];
            if ((firstInstance.payment_status?.includes('partly') || firstInstance.payment_status?.includes('fully')) && firstInstance.payment_amount) {
              const amount = typeof firstInstance.payment_amount === 'number' 
                ? firstInstance.payment_amount 
                : parseFloat(String(firstInstance.payment_amount));
              if (!isNaN(amount) && amount > 0) {
                monthEventIncome += amount;
              }
            }
          }

          // Get additional persons (customers) for events in this month
          const monthParentEventIds = monthEvents
            ?.filter(event => !event.parent_event_id)
            .map(event => event.id) || [];

          if (monthParentEventIds.length > 0) {
            const { data: monthCustomers } = await supabase
              .from('customers')
              .select('*')
              .in('event_id', monthParentEventIds)
              .eq('type', 'customer')
              .is('deleted_at', null);

            if (monthCustomers) {
              // Process customers for recurring series
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
                      monthEventIncome += amount;
                    }
                  }
                });
              }

              // Process customers for non-recurring events
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
                    monthEventIncome += amount;
                  }
                }
              });
            }
          }
        }

        // CRITICAL FIX: Add standalone customer income (customers without event_id)
        const { data: monthStandaloneCustomers } = await supabase
          .from('customers')
          .select('*')
          .eq('user_id', boardUserId)
          .is('event_id', null)
          .gte('created_at', monthStart.toISOString())
          .lte('created_at', monthEnd.toISOString())
          .is('deleted_at', null);

        if (monthStandaloneCustomers) {
          monthStandaloneCustomers.forEach(customer => {
            const paymentStatus = customer.payment_status || '';
            if ((paymentStatus.includes('partly') || paymentStatus.includes('fully')) && customer.payment_amount) {
              const amount = typeof customer.payment_amount === 'number' 
                ? customer.payment_amount 
                : parseFloat(String(customer.payment_amount));
              if (!isNaN(amount) && amount > 0) {
                monthCustomerIncome += amount;
              }
            }
          });
        }

        const totalMonthIncome = monthEventIncome + monthCustomerIncome;

        threeMonthData.push({
          month: monthShort,
          income: totalMonthIncome,
          eventIncome: monthEventIncome,
          customerIncome: monthCustomerIncome
        });

        console.log(`Month ${monthShort} income: ${totalMonthIncome} (events: ${monthEventIncome}, customers: ${monthCustomerIncome})`);
      }

      console.log('3-month income comparison with standalone customers:', threeMonthData);
      return threeMonthData;
    },
    enabled: !!boardUserId,
    refetchInterval: false,
  });

  // Fetch customer statistics with date range filtering (matching internal dashboard logic EXACTLY)
  const { data: customerStats, isLoading: isLoadingCustomers } = useQuery({
    queryKey: ['publicCustomerStats', boardUserId, dateRange],
    queryFn: async () => {
      console.log('Fetching public customer stats for user:', boardUserId, 'date range:', dateRange);
      
      const startDateStr = dateRange.start.toISOString();
      const endDateStr = dateRange.end.toISOString();

      // Track unique customers with Set to avoid duplicates (same logic as internal dashboard)
      const uniqueCustomers = new Set<string>();
      const withBookingSet = new Set<string>();
      const withoutBookingSet = new Set<string>();

      // Get regular events in the date range (filter by start_date for events happening in this period)
      const { data: regularEvents, error: regularEventsError } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', boardUserId)
        .gte('start_date', startDateStr)
        .lte('start_date', endDateStr)
        .is('parent_event_id', null)
        .is('deleted_at', null);

      if (regularEventsError) {
        console.error('Error fetching events for customer stats:', regularEventsError);
      } else if (regularEvents) {
        // Add main event persons as unique customers (WITH booking)
        regularEvents.forEach(event => {
          const customerKey = `${event.social_network_link || 'no-email'}_${event.user_number || 'no-phone'}_${event.user_surname || 'no-name'}`;
          uniqueCustomers.add(customerKey);
          withBookingSet.add(customerKey);
        });
      }

      // Get approved booking requests in the date range (filter by start_date)
      const { data: bookingRequests, error: bookingRequestsError } = await supabase
        .from('booking_requests')
        .select('*')
        .eq('user_id', boardUserId)
        .eq('status', 'approved')
        .gte('start_date', startDateStr)
        .lte('start_date', endDateStr)
        .is('deleted_at', null);

      if (bookingRequestsError) {
        console.error('Error fetching booking requests for customer stats:', bookingRequestsError);
      }
      // Booking requests main persons are intentionally excluded from customer stats to match CRM page counts

      // Get event IDs for additional customers lookup
      const eventIdsInRange = regularEvents?.map(e => e.id) || [];

      // Get additional customers from CRM (type = 'customer') whose events are in the date range
      if (eventIdsInRange.length > 0) {
        const { data: crmCustomers, error: crmCustomersError } = await supabase
          .from('customers')
          .select('*')
          .eq('user_id', boardUserId)
          .eq('type', 'customer')
          .in('event_id', eventIdsInRange)
          .is('deleted_at', null);

        if (!crmCustomersError && crmCustomers) {
          // These are additional persons for events (WITH booking)
          crmCustomers.forEach(customer => {
            const customerKey = `${customer.social_network_link || 'no-email'}_${customer.user_number || 'no-phone'}_${customer.user_surname || customer.title || 'no-name'}`;
            uniqueCustomers.add(customerKey);
            withBookingSet.add(customerKey);
          });
        }
      }

      // Get standalone CRM customers (customers without events, added in date range)
      const { data: standaloneCrmCustomers, error: standaloneCrmError } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', boardUserId)
        .is('event_id', null)
        .gte('created_at', startDateStr)
        .lte('created_at', endDateStr)
        .is('deleted_at', null);

      if (!standaloneCrmError && standaloneCrmCustomers) {
        // Standalone CRM customers (WITHOUT booking)
        standaloneCrmCustomers.forEach(customer => {
          const customerKey = `${customer.social_network_link || 'no-email'}_${customer.user_number || 'no-phone'}_${customer.user_surname || customer.title || 'no-name'}`;
          uniqueCustomers.add(customerKey);
          withoutBookingSet.add(customerKey);
        });
      }

      // Ensure customers that appear in both sets are counted as WITH booking (same logic as internal)
      for (const key of withBookingSet) {
        if (withoutBookingSet.has(key)) withoutBookingSet.delete(key);
      }

      const totalCustomers = uniqueCustomers.size;
      const withBooking = withBookingSet.size;
      const withoutBooking = withoutBookingSet.size;
      
      console.log('Public customer stats (matching internal logic):', { 
        totalCustomers, 
        withBooking, 
        withoutBooking,
        regularEventsCount: regularEvents?.length || 0,
        bookingRequestsCount: bookingRequests?.length || 0,
        crmCustomersCount: eventIdsInRange.length,
        standaloneCrmCustomersCount: standaloneCrmCustomers?.length || 0
      });
      
      return {
        total: totalCustomers,
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
          queryClient.invalidateQueries({ queryKey: ['publicThreeMonthIncome', boardUserId] });
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
          queryClient.invalidateQueries({ queryKey: ['publicThreeMonthIncome', boardUserId] });
        }
      )
      .subscribe();

    const bookingRequestsChannel = supabase
      .channel('public_stats_booking_requests')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'booking_requests',
          filter: `user_id=eq.${boardUserId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['publicEventStats', boardUserId, dateRange] });
          queryClient.invalidateQueries({ queryKey: ['publicThreeMonthIncome', boardUserId] });
        }
      )
      .subscribe();

    return () => {
      console.log('Cleaning up real-time statistics subscriptions');
      supabase.removeChannel(tasksChannel);
      supabase.removeChannel(eventsChannel);
      supabase.removeChannel(customersChannel);
      supabase.removeChannel(bookingRequestsChannel);
    };
  }, [boardUserId, queryClient, dateRange]);

  const handleDateChange = (start: Date, end: Date | null) => {
    console.log("Public stats date range changed to:", { start, end: end || start });
    setDateRange({ start, end: end || start });
  };

  const handleExport = () => {
    if (currentEventStats && currentTaskStats && currentCustomerStats) {
      const exportData = {
        taskStats: currentTaskStats,
        eventStats: {
          ...currentEventStats,
          events: eventStats?.events || []
        },
        customerStats: currentCustomerStats
      };
      exportToExcel(exportData);
    }
  };

  // Default stats
  const defaultTaskStats = { total: 0, completed: 0, inProgress: 0, todo: 0 };
  const defaultEventStats = { total: 0, partlyPaid: 0, fullyPaid: 0, totalIncome: 0, monthlyIncome: [], dailyStats: [], events: [] };
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
      <h2 className="text-2xl font-bold text-foreground">{t('dashboard.statistics')}</h2>

      <StatsHeader 
        dateRange={dateRange}
        onDateChange={handleDateChange}
        onExport={handleExport}
        isLoading={isLoading}
        onlineUsers={onlineUsers}
        currentUserEmail={externalUserEmail}
      />
      
      <StatsCards 
        taskStats={currentTaskStats} 
        eventStats={currentEventStats}
        customerStats={currentCustomerStats}
      />

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <BookingChart data={currentEventStats.dailyStats || []} />
        <IncomeChart data={threeMonthIncome || []} />
      </div>
    </div>
  );
};