
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BusinessProfile } from "@/types/database";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

interface StatisticsProps {
  businessProfile: BusinessProfile;
}

export const Statistics = ({ businessProfile }: StatisticsProps) => {
  const { data: bookingStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['business-statistics', businessProfile.id],
    queryFn: async () => {
      const { data: bookings, error } = await supabase
        .from('booking_requests')
        .select('*')
        .eq('business_id', businessProfile.id);
      
      if (error) throw error;
      
      const totalBookings = bookings?.length || 0;
      const approvedBookings = bookings?.filter(b => b.status === 'approved').length || 0;
      const pendingBookings = bookings?.filter(b => b.status === 'pending').length || 0;
      const rejectedBookings = bookings?.filter(b => b.status === 'rejected').length || 0;
      
      // Group bookings by month
      const bookingsByMonth: Record<string, number> = {};
      bookings?.forEach(booking => {
        const month = new Date(booking.created_at).toLocaleString('default', { month: 'short' });
        bookingsByMonth[month] = (bookingsByMonth[month] || 0) + 1;
      });
      
      const monthlyData = Object.entries(bookingsByMonth).map(([month, count]) => ({
        month,
        bookings: count
      }));
      
      // Group by status
      const statusData = [
        { name: 'Approved', value: approvedBookings },
        { name: 'Pending', value: pendingBookings },
        { name: 'Rejected', value: rejectedBookings }
      ];
      
      return {
        totalBookings,
        approvedBookings,
        pendingBookings,
        rejectedBookings,
        monthlyData,
        statusData
      };
    },
    enabled: !!businessProfile.id
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingStats ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <div className="text-2xl font-bold">{bookingStats?.totalBookings}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingStats ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <div className="text-2xl font-bold text-green-600">{bookingStats?.approvedBookings}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingStats ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <div className="text-2xl font-bold text-yellow-600">{bookingStats?.pendingBookings}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingStats ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <div className="text-2xl font-bold text-red-600">{bookingStats?.rejectedBookings}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Bookings By Month</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            {isLoadingStats ? (
              <Skeleton className="h-full w-full" />
            ) : bookingStats && bookingStats.monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={bookingStats.monthlyData}>
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="bookings" stroke="#8884d8" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No booking data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bookings By Status</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            {isLoadingStats ? (
              <Skeleton className="h-full w-full" />
            ) : bookingStats ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bookingStats.statusData}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No booking data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
