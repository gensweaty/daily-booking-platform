
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Users, UserPlus, Activity } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { DateRangeSelect } from '@/components/Statistics/DateRangeSelect';
import { startOfMonth, endOfMonth } from 'date-fns';

interface AnalyticsData {
  totalUsers: number;
  newUsers24h: number;
  activeSessions: number;
  avgSessionTime: string;
  registrationData: Array<{ hour: string; users: number }>;
  subscriptionData: Array<{ name: string; value: number; color: string }>;
}

export const AnalyticsCharts = () => {
  const currentDate = new Date();
  const [dateRange, setDateRange] = useState({ 
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate)
  });
  
  const [data, setData] = useState<AnalyticsData>({
    totalUsers: 0,
    newUsers24h: 0,
    activeSessions: 0,
    avgSessionTime: '0m',
    registrationData: [],
    subscriptionData: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalyticsData();
  }, [dateRange]);

  const fetchAnalyticsData = async () => {
    try {
      const { data: analyticsData, error } = await supabase.functions.invoke('admin-panel-data', {
        body: { 
          type: 'analytics',
          dateRange: {
            start: dateRange.start.toISOString(),
            end: dateRange.end.toISOString()
          }
        }
      });

      if (error) throw error;
      setData(analyticsData || data);
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (start: Date, end: Date | null) => {
    setDateRange({ start, end: end || start });
  };

  const MetricCard = ({ title, value, icon: Icon, trend }: { 
    title: string; 
    value: string | number; 
    icon: any; 
    trend?: string 
  }) => (
    <Card className="bg-card border-border">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
            <p className="text-3xl font-bold text-foreground">{value}</p>
            {trend && <p className="text-xs text-muted-foreground mt-1">{trend}</p>}
          </div>
          <div className="flex items-center justify-center w-12 h-12 bg-primary/10 rounded-lg">
            <Icon className="w-6 h-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // Enhanced tooltip component with better dark mode support
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border border-border rounded-lg shadow-xl p-3 backdrop-blur-sm">
          <p className="text-foreground font-medium mb-1">{`${label}`}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-foreground text-sm">
              {`${entry.name || 'Users'}: ${entry.value}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Enhanced pie chart tooltip with better contrast
  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-background border border-border rounded-lg shadow-xl p-3 backdrop-blur-sm">
          <p className="text-foreground font-medium">{`${data.name}: ${data.value}`}</p>
          <p className="text-muted-foreground text-sm">
            {data.value > 0 ? `${((data.value / data.payload.total) * 100 || 0).toFixed(1)}%` : '0%'}
          </p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="h-10 bg-muted rounded w-64 animate-pulse"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="bg-card border-border">
              <CardContent className="p-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-muted rounded"></div>
                  <div className="h-8 bg-muted rounded"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Calculate total for percentage calculation
  const totalSubscriptions = data.subscriptionData.reduce((sum, item) => sum + item.value, 0);
  const subscriptionDataWithTotal = data.subscriptionData.map(item => ({
    ...item,
    total: totalSubscriptions
  }));

  return (
    <div className="space-y-8">
      {/* Date Range Filter */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <DateRangeSelect
          selectedDate={dateRange}
          onDateChange={handleDateChange}
          disabled={loading}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard title="New users (selected period)" value={data.newUsers24h} icon={UserPlus} />
        <MetricCard title="Total users" value={data.totalUsers} icon={Users} />
        <MetricCard title="Paying subscribers" value={data.subscriptionData.filter(s => s.name !== 'Trial').reduce((a, s) => a + s.value, 0)} icon={Activity} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* User Registrations Chart */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-semibold text-foreground">User Registrations</CardTitle>
            <p className="text-sm text-muted-foreground">Registration breakdown for selected period</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.registrationData} margin={{ left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="hour" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis 
                  allowDecimals={false}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="users" 
                  fill="hsl(var(--primary))"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Subscription Distribution Chart */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-semibold text-foreground">Subscription Distribution</CardTitle>
            <p className="text-sm text-muted-foreground">Current subscription plan breakdown ({totalSubscriptions} total users)</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={subscriptionDataWithTotal}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {subscriptionDataWithTotal.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomPieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center mt-4 space-x-4 flex-wrap gap-2">
              {data.subscriptionData.map((entry, index) => (
                <div key={index} className="flex items-center">
                  <div 
                    className="w-3 h-3 rounded-full mr-2" 
                    style={{ backgroundColor: entry.color }}
                  ></div>
                  <span className="text-sm text-muted-foreground">
                    {entry.name} ({entry.value})
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
