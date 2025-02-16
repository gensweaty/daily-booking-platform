
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
import { format, differenceInMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { useLanguage } from "@/contexts/LanguageContext";

interface BookingChartProps {
  data: Array<{
    day: string;
    bookings: number;
    date: Date;
    month: string;
  }>;
}

export const BookingChart = ({ data }: BookingChartProps) => {
  const { language } = useLanguage();
  const isSpanish = language === 'es';
  
  // Check if the date range spans multiple months
  const isMultiMonth = data.length > 0 && 
    differenceInMonths(
      data[data.length - 1].date,
      data[0].date
    ) > 0;

  // Transform data to show real cumulative growth and handle date display
  const transformedData = data.reduce((acc: Array<{ date: string; total: number }>, item, index) => {
    const previousTotal = acc.length > 0 ? acc[acc.length - 1].total : 0;
    const currentTotal = previousTotal + item.bookings;
    
    // Only add points when there's an actual increase in bookings or it's the first entry
    if (currentTotal > previousTotal || index === 0) {
      const dateLabel = isMultiMonth ? 
        format(item.date, 'MMM d', { locale: isSpanish ? es : undefined }) : // Just show Month Day for multi-month view
        `${parseInt(item.day)} ${format(item.date, 'MMM', { locale: isSpanish ? es : undefined })}`; // Show Day Month for single month
      
      acc.push({
        date: dateLabel,
        total: currentTotal,
      });
    }
    
    return acc;
  }, []);

  const title = isSpanish ? "Crecimiento Total de Reservas" : "Total Bookings Growth";
  const xAxisLabel = isSpanish ? "Fechas de Reserva" : "Booking Dates";
  const yAxisLabel = isSpanish ? "Total de Reservas" : "Total Bookings";

  return (
    <Card className="p-4">
      <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
        <TrendingUp className="w-4 h-4" />
        {title}
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
              interval={isMultiMonth ? 2 : 0} // Show fewer ticks in multi-month view
              angle={isMultiMonth ? -45 : 0} // Angle the text in multi-month view
              label={{ 
                value: xAxisLabel, 
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
                value: yAxisLabel, 
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
              name={yAxisLabel}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};
