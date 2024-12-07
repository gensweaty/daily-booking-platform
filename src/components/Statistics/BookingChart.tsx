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
  // Transform data to create a smooth continuous line
  const transformedData = data.map((item, index, array) => {
    let bookingValue = item.bookings;
    
    // If it's not the first item and there's a change in bookings,
    // create intermediate points for smoother transitions
    if (index > 0 && array[index - 1].bookings !== item.bookings) {
      const prevValue = array[index - 1].bookings;
      const currentValue = item.bookings;
      bookingValue = prevValue + (currentValue - prevValue) * 0.5;
    }
    
    return {
      ...item,
      bookings: bookingValue
    };
  });

  return (
    <Card className="p-4">
      <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
        <TrendingUp className="w-4 h-4" />
        Daily Bookings
      </h3>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart 
            data={transformedData || []}
            margin={{ top: 10, right: 30, left: 10, bottom: 30 }}
          >
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="#e5e7eb"
              vertical={false}
            />
            <XAxis 
              dataKey="day"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              dy={10}
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
              name="Bookings"
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};