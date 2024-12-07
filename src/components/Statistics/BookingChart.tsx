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

interface BookingChartProps {
  data: Array<{
    day: string;
    bookings: number;
  }>;
}

export const BookingChart = ({ data }: BookingChartProps) => {
  // Transform data to show cumulative growth
  const transformedData = data.reduce((acc: any[], item, index) => {
    const previousTotal = index > 0 ? acc[index - 1].bookings : 0;
    const currentTotal = previousTotal + item.bookings;
    
    // Add the main point
    acc.push({
      point: index + 1,
      bookings: currentTotal,
    });
    
    // If there's a change in bookings, add intermediate points for smoother curve
    if (item.bookings > 0) {
      // Add two intermediate points for each booking for smoother curve
      acc.push({
        point: index + 1.33,
        bookings: currentTotal - (item.bookings * 0.66),
      });
      
      acc.push({
        point: index + 1.66,
        bookings: currentTotal - (item.bookings * 0.33),
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
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart 
            data={transformedData}
            margin={{ top: 10, right: 30, left: 10, bottom: 30 }}
          >
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="#e5e7eb"
              vertical={false}
            />
            <XAxis 
              dataKey="point"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              dy={10}
              interval={1}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              domain={[0, 'auto']}
              allowDecimals={false}
              dx={-10}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="bookings"
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