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
  return (
    <Card className="p-4">
      <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
        <TrendingUp className="w-4 h-4" />
        Daily Bookings
      </h3>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="day"
              label={{ value: 'Days of Month', position: 'bottom' }}
              tick={{ fontSize: 12 }}
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
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};