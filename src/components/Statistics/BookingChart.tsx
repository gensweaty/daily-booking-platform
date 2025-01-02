import { Card } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { CustomTooltip } from "./CustomTooltip";
import { format } from 'date-fns';

interface BookingChartProps {
  data: Array<{
    day: string;
    bookings: number;
    date: Date; // Add date to the interface
  }>;
}

export const BookingChart = ({ data }: BookingChartProps) => {
  // Transform data to show real cumulative growth with dates
  const transformedData = data.reduce((acc: Array<{ date: string; total: number }>, item, index, arr) => {
    const previousTotal = acc.length > 0 ? acc[acc.length - 1].total : 0;
    const currentTotal = previousTotal + item.bookings;
    
    // Only add points when there's an actual increase in bookings
    if (currentTotal > previousTotal) {
      // Format the date using the actual date from the data
      const formattedDate = `${parseInt(item.day)} ${format(item.date, 'MMM')}`;
      acc.push({
        date: formattedDate,
        total: currentTotal,
      });
    }
    
    return acc;
  }, []);

  return (
    <Card className="p-4">
      <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
        <TrendingUp className="w-4 h-4" />
        Total Bookings Growth
      </h3>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart 
            data={transformedData}
            margin={{ top: 10, right: 30, left: 10, bottom: 40 }}
          >
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="#e5e7eb"
              vertical={false}
            />
            <XAxis 
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              dy={16}
              height={60}
              interval={0}
              label={{ 
                value: 'Booking Dates', 
                position: 'bottom', 
                offset: 20,
                style: { textAnchor: 'middle' }
              }}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              domain={[0, 'auto']}
              allowDecimals={false}
              dx={-10}
              label={{ 
                value: 'Total Bookings', 
                angle: -90, 
                position: 'insideLeft', 
                offset: 0,
                style: { textAnchor: 'middle' }
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="total"
              stroke="#2DD4BF"
              strokeWidth={2}
              dot={{
                fill: "#2DD4BF",
                r: 4,
                strokeWidth: 2,
                stroke: "#fff"
              }}
              activeDot={{
                r: 6,
                stroke: "#2DD4BF",
                strokeWidth: 2,
                fill: "#fff"
              }}
              name="Total Bookings"
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};