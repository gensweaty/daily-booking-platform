
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
        // Remove any non-numeric characters except dots and minus signs, accept comma as decimal separator
        const cleanedStr = amount.replace(',', '.').replace(/[^0-9.-]+/g, '');
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

  // Normalize payment status across variants/localizations
  const normalizePaymentStatus = (raw: string | null | undefined): string => {
    if (!raw) return 'not_paid';
    const s = String(raw).toLowerCase().trim();

    // common English variants
    if (s.includes('fully') || s === 'paid' || s.includes('full')) return 'fully_paid';
    if (s.includes('partial') || s.includes('partly') || s.includes('half')) return 'partly_paid';
    if (s.includes('not') || s.includes('unpaid') || s === 'none') return 'not_paid';

    // loose safety net: map any "paid" to partly/fully as "partly" unless explicitly fully
    if (s.includes('paid')) return 'partly_paid';

    // Georgian hints (harmless if unused)
    if (s.includes('სრულ')) return 'fully_paid';
    if (s.includes('ნაწილი')) return 'partly_paid';
    if (s.includes('გაუხდ')) return 'not_paid';

    return s;
  };

  // Effective date: event → start_date, standalone customer → created_at
  const getEffectiveDate = (row: any, isStandalone = false): string | null => {
    const src = isStandalone ? row?.created_at : row?.start_date;
    if (!src) return null;
    try {
      return new Date(src).toISOString();
    } catch {
      return null;
    }
  };

  // Standalone rules: strictly no event, and not marked to create an event
  const isStandaloneRow = (r: any) =>
    (r?.event_id == null) &&
    (r?.create_event === false || r?.create_event == null) &&
    (r?.type == null || r?.type === 'customer');

  // Filter array safely
  const onlyStandalone = (rows: any[] | null | undefined) => (rows ?? []).filter(isStandaloneRow);

  // Optimize events stats query with improved multi-person income calculation
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
      
      // Get all calendar events, CRM events, customers, and standalone customers concurrently
      const [calendarEventsResult, crmEventsResult, customersResult, standaloneCustomersResult] = await Promise.all([
        supabase
          .from('events')
          .select('*')
          .eq('user_id', userId)
          .gte('start_date', startDateStr)
          .lte('start_date', endDateStr)
          .is('deleted_at', null),

        supabase
          .from('customers')
          .select('*')
          .eq('user_id', userId)
          .eq('create_event', true)
          .gte('start_date', startDateStr)
          .lte('start_date', endDateStr)
          .is('deleted_at', null),

        // Get all customers to find additional persons for events
        supabase
          .from('customers')
          .select('*')
          .eq('user_id', userId)
          .or('type.eq.customer,type.is.null')
          .gte('start_date', startDateStr)
          .lte('start_date', endDateStr)
          .is('deleted_at', null),

        // Standalone customers: select by created_at ONLY, event date dominates → exclude any with event_id
        supabase
          .from('customers')
          .select('*')
          .eq('user_id', userId)
          .is('deleted_at', null)
          .is('event_id', null)                 // hard exclude any that got an event later
          .gte('created_at', startDateStr)      // added-date window
          .lte('created_at', endDateStr)
      ]);

      if (calendarEventsResult.error) {
        console.error('Error fetching calendar events:', calendarEventsResult.error);
        throw calendarEventsResult.error;
      }
      
      if (crmEventsResult.error) {
        console.error('Error fetching CRM events:', crmEventsResult.error);
        throw crmEventsResult.error;
      }

      if (customersResult.error) {
        console.error('Error fetching customers:', customersResult.error);
        throw customersResult.error;
      }

      if (standaloneCustomersResult.error) {
        console.error('Error fetching standalone customers:', standaloneCustomersResult.error);
        throw standaloneCustomersResult.error;
      }

      const standaloneCustomers = onlyStandalone(standaloneCustomersResult.data);
      
      console.log(`Statistics - Found ${calendarEventsResult.data?.length || 0} calendar events, ${crmEventsResult.data?.length || 0} CRM events, ${customersResult.data?.length || 0} additional customers, and ${standaloneCustomers.length} standalone customers with payments`);
      
      // Group events by their date/time to identify multi-person events
      const eventGroups = new Map<string, any[]>();
      
      // Process main events (calendar + CRM)
      const allMainEvents = [
        ...(calendarEventsResult.data || []), 
        ...(crmEventsResult.data || [])
      ];

      // Group events by start_date and end_date
      allMainEvents.forEach(event => {
        const key = `${event.start_date}-${event.end_date}`;
        if (!eventGroups.has(key)) {
          eventGroups.set(key, []);
        }
        eventGroups.get(key)?.push({
          ...event,
          payment_status: normalizePaymentStatus(event.payment_status),
          source: 'main_event'
        });
      });

      // Add customers to their corresponding event groups
      (customersResult.data || []).forEach(customer => {
        const key = `${customer.start_date}-${customer.end_date}`;
        if (eventGroups.has(key)) {
          eventGroups.get(key)?.push({
            ...customer,
            payment_status: normalizePaymentStatus(customer.payment_status),
            source: 'additional_person'
          });
        }
      });

      console.log(`Statistics - Combined into ${eventGroups.size} unique event groups`);
      
      // Process statistics with multi-person income calculation
      let total = eventGroups.size; // Count unique events, not individual persons
      let partlyPaid = 0;
      let fullyPaid = 0;
      let totalIncome = 0;

      const dailyBookings = new Map<string, number>();
      const monthlyIncomeMap = new Map<string, number>();
      const processedEvents: any[] = [];

      for (const [timeKey, eventGroup] of eventGroups) {
        // Calculate combined payment status and income for this event group
        let groupIncome = 0;
        let hasPartlyPaid = false;
        let hasFullyPaid = false;
        let hasAnyPayment = false;

        // Find the main event for display purposes
        const mainEvent = eventGroup.find(e => e.source === 'main_event') || eventGroup[0];

        // Log detailed payment information for each person in the group
        console.log(`Event group ${timeKey} payment data:`);
        eventGroup.forEach((person, index) => {
          if (person.payment_amount !== undefined && person.payment_amount !== null) {
            console.log(`Person ${index + 1} (${person.id}):`, {
              title: person.title,
              raw_payment_amount: person.payment_amount,
              type_of: typeof person.payment_amount,
              payment_status: person.payment_status,
              parsed_amount: parsePaymentAmount(person.payment_amount)
            });
          }
        });

        // Sum up all payments from all persons in this event group
        eventGroup.forEach(person => {
          const status = normalizePaymentStatus(person.payment_status);
          
          if (status === 'partly_paid') {
            hasPartlyPaid = true;
            hasAnyPayment = true;
          }
          if (status === 'fully_paid') {
            hasFullyPaid = true;
            hasAnyPayment = true;
          }

          // Income calculation - sum from all persons in the event
          if ((status === 'partly_paid' || status === 'fully_paid') && person.payment_amount) {
            const parsedAmount = parsePaymentAmount(person.payment_amount);
            if (parsedAmount > 0) {
              groupIncome += parsedAmount;
              console.log(`Adding ${parsedAmount} from person ${person.id} in event group ${timeKey}`);
            }
          }
        });

        // Count payment status for the event (not per person)
        if (hasPartlyPaid && !hasFullyPaid) partlyPaid++;
        if (hasFullyPaid) fullyPaid++;

        // Add group income to total
        totalIncome += groupIncome;

        // Daily and monthly stats (count as one event, not per person)
        if (mainEvent.start_date) {
          try {
            const eventDate = parseISO(mainEvent.start_date);
            const day = format(eventDate, 'yyyy-MM-dd');
            dailyBookings.set(day, (dailyBookings.get(day) || 0) + 1);

            // Monthly income aggregation (use group income)
            if (hasAnyPayment && groupIncome > 0) {
              const month = format(eventDate, 'MMM yyyy');
              monthlyIncomeMap.set(month, (monthlyIncomeMap.get(month) || 0) + groupIncome);
            }
          } catch (dateError) {
            console.warn('Invalid date in event:', mainEvent.start_date);
          }
        }

        // Create a combined event entry for export compatibility
        const effectiveEventDate = getEffectiveDate(mainEvent, false);
        processedEvents.push({
          ...mainEvent,
          combined_payment_amount: groupIncome,
          person_count: eventGroup.length,
          all_persons: eventGroup,
          effective_date: effectiveEventDate,
          effective_date_source: 'event_date'
        });
      }

      // Process standalone customers (customers without events)
      console.log(`🔍 Processing ${standaloneCustomers.length} standalone customers from initial query`);
      console.log(`📅 Date range: ${startDateStr} to ${endDateStr}`);
      
      standaloneCustomers.forEach(customer => {
        const status = normalizePaymentStatus(customer.payment_status);
        const amount = parsePaymentAmount(customer.payment_amount);
        const effective = getEffectiveDate(customer, true); // created_at

        console.log(`👤 Standalone customer ${customer.id}:`, {
          title: customer.title,
          raw_status: customer.payment_status,
          normalized_status: status,
          raw_amount: customer.payment_amount,
          parsed_amount: amount,
          created_at: customer.created_at,
          effective_date: effective,
          event_id: customer.event_id,
          create_event: customer.create_event
        });

        // Only count paid items with a usable timestamp
        if ((status === 'partly_paid' || status === 'fully_paid') && amount > 0 && effective) {
          console.log(`✅ Including standalone customer ${customer.id} with amount ${amount}`);
          
          // tally counts (status-level)
          if (status === 'partly_paid') partlyPaid++;
          if (status === 'fully_paid') fullyPaid++;

          // add to total income
          totalIncome += amount;
          console.log(`💰 Total income now: ${totalIncome}`);

          // month bucketing by adding date (created_at)
          try {
            const dt = parseISO(effective);
            const monthKey = format(dt, 'MMM yyyy');
            const previousMonthTotal = monthlyIncomeMap.get(monthKey) || 0;
            monthlyIncomeMap.set(monthKey, previousMonthTotal + amount);
            console.log(`📊 Adding ${amount} from standalone customer to month ${monthKey}, new total: ${previousMonthTotal + amount}`);
          } catch (err) { 
            console.warn('⚠️ Invalid date for standalone customer:', customer.id, err);
          }

          // push into processedEvents so exports + filtered sums see it
          processedEvents.push({
            id: customer.id,
            title: customer.title,
            user_surname: customer.title,
            user_number: customer.user_number,
            social_network_link: customer.social_network_link,
            payment_status: status,
            payment_amount: amount,
            start_date: effective,
            end_date: effective,
            event_notes: customer.event_notes,
            source: 'standalone_customer',
            combined_payment_amount: amount,
            person_count: 1,
            all_persons: [customer],
            effective_date: effective,
            effective_date_source: 'added_date'
          });
        } else {
          console.log(`❌ Skipping standalone customer ${customer.id}: status=${status}, amount=${amount}, effective=${effective}`);
        }
      });
      
      console.log(`📊 Final standalone stats: ${standaloneCustomers.length} found, ${partlyPaid + fullyPaid} with payments, total income: ${totalIncome}`);

      // Update total count to include standalone customers (only paid ones)
      const paidStandaloneCount = standaloneCustomers.filter(c => {
        const status = normalizePaymentStatus(c.payment_status);
        const amount = parsePaymentAmount(c.payment_amount);
        return (status === 'partly_paid' || status === 'fully_paid') && amount > 0;
      }).length;
      total = eventGroups.size + paidStandaloneCount;
      console.log(`📊 Total count: ${eventGroups.size} event groups + ${paidStandaloneCount} paid standalone customers = ${total}`);

      // Get all days in the selected range for daily bookings
      const daysInRange = eachDayOfInterval({
        start: dateRange.start,
        end: dateRange.end
      });

      const dailyBookingsArray = daysInRange.map(day => {
        const dayKey = format(day, 'yyyy-MM-dd');
        return {
          day: format(day, 'dd'),
          date: day,
          month: format(day, 'MMM yyyy'),
          bookings: dailyBookings.get(dayKey) || 0,
        };
      });

      // NEW LOGIC: Monthly income should ALWAYS show 3 months (current + past 2) for the income chart
      // while other statistics respect the selected date range
      const currentDate = new Date();
      const isDefaultDateRange = 
        format(dateRange.start, 'yyyy-MM-dd') === format(startOfMonth(currentDate), 'yyyy-MM-dd') &&
        format(dateRange.end, 'yyyy-MM-dd') === format(endOfMonth(currentDate), 'yyyy-MM-dd');

      const incomeRangeStart = addMonths(startOfMonth(currentDate), -2);
      const incomeRangeEnd = endOfDay(endOfMonth(currentDate));
      
      let allEventsForIncome = processedEvents;
      
      if (isDefaultDateRange) {
        // We need to fetch events from the wider range for income calculation
        const [additionalCalendarEvents, additionalCrmEvents, additionalCustomers, additionalStandaloneCustomers] = await Promise.all([
          supabase
            .from('events')
            .select('*')
            .eq('user_id', userId)
            .gte('start_date', incomeRangeStart.toISOString())
            .lte('start_date', incomeRangeEnd.toISOString())
            .is('deleted_at', null),

          supabase
            .from('customers')
            .select('*')
            .eq('user_id', userId)
            .eq('create_event', true)
            .gte('start_date', incomeRangeStart.toISOString())
            .lte('start_date', incomeRangeEnd.toISOString())
            .is('deleted_at', null),

          supabase
            .from('customers')
            .select('*')
            .eq('user_id', userId)
            .or('type.eq.customer,type.is.null')
            .gte('start_date', incomeRangeStart.toISOString())
            .lte('start_date', incomeRangeEnd.toISOString())
            .is('deleted_at', null),

          // Standalone customers: same pattern for 3-month window
          supabase
            .from('customers')
            .select('*')
            .eq('user_id', userId)
            .is('deleted_at', null)
            .is('event_id', null)
            .gte('created_at', incomeRangeStart.toISOString())
            .lte('created_at', incomeRangeEnd.toISOString())
        ]);

        // Process additional events with the same grouping logic
        const additionalEventGroups = new Map<string, any[]>();
        
        const allAdditionalMainEvents = [
          ...(additionalCalendarEvents.data || []), 
          ...(additionalCrmEvents.data || [])
        ];

        allAdditionalMainEvents.forEach(event => {
          const key = `${event.start_date}-${event.end_date}`;
          if (!additionalEventGroups.has(key)) {
            additionalEventGroups.set(key, []);
          }
          additionalEventGroups.get(key)?.push({
            ...event,
            payment_status: normalizePaymentStatus(event.payment_status),
            source: 'main_event'
          });
        });

        (additionalCustomers.data || []).forEach(customer => {
          const key = `${customer.start_date}-${customer.end_date}`;
          if (additionalEventGroups.has(key)) {
            additionalEventGroups.get(key)?.push({
              ...customer,
              payment_status: normalizePaymentStatus(customer.payment_status),
              source: 'additional_person'
            });
          }
        });

        // Process additional events
        const additionalProcessedEvents: any[] = [];
        for (const [timeKey, eventGroup] of additionalEventGroups) {
          let groupIncome = 0;
          const mainEvent = eventGroup.find(e => e.source === 'main_event') || eventGroup[0];

          eventGroup.forEach(person => {
            const status = normalizePaymentStatus(person.payment_status);
            if ((status === 'partly_paid' || status === 'fully_paid') && person.payment_amount) {
              const parsedAmount = parsePaymentAmount(person.payment_amount);
              if (parsedAmount > 0) {
                groupIncome += parsedAmount;
              }
            }
          });

          additionalProcessedEvents.push({
            ...mainEvent,
            combined_payment_amount: groupIncome,
            person_count: eventGroup.length,
            all_persons: eventGroup,
            effective_date: getEffectiveDate(mainEvent, false),
            effective_date_source: 'event_date'
          });
        }

        const additionalStandaloneCustomers_filtered = onlyStandalone(additionalStandaloneCustomers.data);

        // Add standalone customers to the income events
        additionalStandaloneCustomers_filtered.forEach(customer => {
          const status = normalizePaymentStatus(customer.payment_status);
          const amount = parsePaymentAmount(customer.payment_amount);
          const effective = getEffectiveDate(customer, true); // created_at

          if ((status === 'partly_paid' || status === 'fully_paid') && amount > 0 && effective) {
            additionalProcessedEvents.push({
              id: customer.id,
              title: customer.title,
              user_surname: customer.title,
              user_number: customer.user_number,
              social_network_link: customer.social_network_link,
              payment_status: status,
              payment_amount: amount,
              start_date: effective,
              end_date: effective,
              event_notes: customer.event_notes,
              source: 'standalone_customer',
              combined_payment_amount: amount,
              person_count: 1,
              all_persons: [customer],
              effective_date: effective,
              effective_date_source: 'added_date'
            });
          }
        });
        
        allEventsForIncome = additionalProcessedEvents;
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
          const dateToUse = event.effective_date || event.start_date || event.created_at;
          if (!dateToUse) {
            console.warn(`Skipping event ${event.id} - no valid date`);
            return false;
          }
          
          try {
            const eventDate = parseISO(dateToUse);
            const isInRange = eventDate >= monthStart && eventDate <= monthEnd;
            if (isInRange && event.source === 'standalone_customer') {
              console.log(`✅ Including standalone customer ${event.id} in month ${format(month, 'MMM yyyy')}`);
            }
            return isInRange;
          } catch (error) {
            console.error(`Invalid date for event ${event.id}:`, dateToUse);
            return false;
          }
        });
        
        // Calculate income from events using combined payment amounts
        let income = 0;
        
        monthEvents.forEach(event => {
          if (event.combined_payment_amount && event.combined_payment_amount > 0) {
            income += event.combined_payment_amount;
            console.log(`Month ${format(month, 'MMM yyyy')} - Added ${event.combined_payment_amount} from event ${event.id}`);
          }
        });
        
        return {
          month: format(month, 'MMM yyyy'),
          income: income,
        };
      });
      
      // Debug: Monthly income data
      console.log('Monthly income data with multi-person calculation:', monthlyIncome);

      // Note: totalIncome is already calculated correctly during processing loop (lines 291 & 338)
      // It includes event groups and standalone customers within the selected date range
      
      console.log('Income calculation summary with multi-person support:', {
        totalDirectCalculation: totalIncome,
        eventGroupCount: eventGroups.size,
        processedEventCount: processedEvents.length,
        isDefaultView: isDefaultDateRange
      });

      // Final validation to ensure totalIncome is a valid number
      if (typeof totalIncome !== 'number' || isNaN(totalIncome)) {
        console.error('Invalid totalIncome detected, resetting to 0:', totalIncome);
        totalIncome = 0;
      }

      console.log(`Final totalIncome value with multi-person calculation: ${totalIncome}`);

      return {
        total,
        partlyPaid,
        fullyPaid,
        dailyStats: dailyBookingsArray,
        monthlyIncome,
        totalIncome,
        events: processedEvents || [],
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
