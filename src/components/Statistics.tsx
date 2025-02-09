
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { CheckSquare, Clock, BanknoteIcon, CalendarIcon, FileSpreadsheet } from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, endOfDay } from 'date-fns';
import { StatCard } from "./Statistics/StatCard";
import { BookingChart } from "./Statistics/BookingChart";
import { IncomeChart } from "./Statistics/IncomeChart";
import { DateRangeSelect } from "./Statistics/DateRangeSelect";
import { useState } from "react";
import { Button } from "./ui/button";
import * as XLSX from 'xlsx';
import { useToast } from "./ui/use-toast";

export const Statistics = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const currentDate = new Date();
  const [dateRange, setDateRange] = useState({ 
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate)
  });

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
    queryKey: ['eventStats', user?.id, dateRange.start, dateRange.end],
    queryFn: async () => {
      const { data: events } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', user?.id)
        .gte('start_date', dateRange.start.toISOString())
        .lte('start_date', endOfDay(dateRange.end).toISOString());

      // Get payment status counts
      const partlyPaid = events?.filter(e => e.payment_status === 'partly').length || 0;
      const fullyPaid = events?.filter(e => e.payment_status === 'fully').length || 0;

      // Get all days in the selected month for daily bookings
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
          bookings: dayEvents?.length || 0,
        };
      });

      // Get three months for income comparison
      const threeMonths = [
        subMonths(startOfMonth(currentDate), 1),
        startOfMonth(currentDate),
        addMonths(startOfMonth(currentDate), 1)
      ];

      const monthlyIncome = await Promise.all(threeMonths.map(async (month) => {
        const monthStart = startOfMonth(month);
        const monthEnd = endOfMonth(month);
        
        const { data: monthEvents } = await supabase
          .from('events')
          .select('*')
          .eq('user_id', user?.id)
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
    enabled: !!user,
  });

  const handleExportExcel = () => {
    if (!eventStats?.events) {
      toast({
        title: "No data to export",
        description: "There are no events in the selected date range.",
        variant: "destructive",
      });
      return;
    }

    // Transform events data for Excel
    const excelData = eventStats.events.map(event => ({
      'Full Name': `${event.title || ''} ${event.user_surname || ''}`.trim(),
      'Phone Number': event.user_number || '',
      'Social Link/Email': event.social_network_link || '',
      'Payment Status': event.payment_status || '',
      'Payment Amount': event.payment_amount || '',
      'Date': event.start_date ? format(new Date(event.start_date), 'dd.MM.yyyy') : '',
      'Time': event.start_date && event.end_date ? 
        `${format(new Date(event.start_date), 'HH:mm')} - ${format(new Date(event.end_date), 'HH:mm')}` : '',
      'Comment': event.event_notes || '',
    }));

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Set column widths
    const colWidths = [
      { wch: 20 },  // Full Name
      { wch: 15 },  // Phone Number
      { wch: 30 },  // Social Link/Email
      { wch: 15 },  // Payment Status
      { wch: 15 },  // Payment Amount
      { wch: 12 },  // Date
      { wch: 20 },  // Time
      { wch: 40 },  // Comment
    ];
    ws['!cols'] = colWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Statistics');

    // Generate Excel file
    const dateStr = format(new Date(), 'dd-MM-yyyy');
    XLSX.writeFile(wb, `statistics-${dateStr}.xlsx`);

    toast({
      title: "Export successful",
      description: "The statistics data has been exported to Excel.",
    });
  };

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
      description: `${eventStats?.partlyPaid || 0} partly paid, ${eventStats?.fullyPaid || 0} fully paid`,
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
      <div className="flex items-center gap-2">
        <DateRangeSelect 
          selectedDate={dateRange}
          onDateChange={(start, end) => setDateRange({ start, end: end || start })}
        />
        <Button
          variant="outline"
          size="icon"
          onClick={handleExportExcel}
          title="Export to Excel"
        >
          <FileSpreadsheet className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <StatCard key={index} {...stat} />
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <BookingChart data={eventStats?.dailyStats || []} />
        <IncomeChart data={eventStats?.monthlyIncome || []} />
      </div>
    </div>
  );
};
