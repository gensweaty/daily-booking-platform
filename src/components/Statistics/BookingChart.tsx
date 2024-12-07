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
  // Transform data to create a continuous line
  const transformedData = data.map((item, index, array) => {
    let bookingValue = item.bookings;
    
    // If it's not the first item and there's a change in bookings,
    // create a smooth transition
    if (index > 0 && array[index - 1].bookings !== item.bookings) {
      bookingValue = array[index - 1].bookings + 
        (item.bookings - array[index - 1].bookings) * 0.5;
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
          <LineChart data={transformedData || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="day"
              label={{ value: 'Days of Month', position: 'bottom' }}
              tick={{ fontSize: 12 }}
              interval={0}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis 
              label={{ 
                value: 'Number of Bookings', 
                angle: -90, 
                position: 'insideLeft',
                offset: -5
              }}
              tick={{ fontSize: 12 }}
              allowDecimals={false}
              domain={[0, 'auto']}
              tickCount={5}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="bookings"
              stroke="#2DD4BF"
              strokeWidth={2}
              dot={{ fill: "#2DD4BF", r: 4 }}
              activeDot={{ r: 6 }}
              name="Bookings"
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};