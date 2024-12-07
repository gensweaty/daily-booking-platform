import { Card } from "@/components/ui/card";
import { BanknoteIcon } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { CustomTooltip } from "./CustomTooltip";

interface IncomeChartProps {
  data: Array<{
    month: string;
    income: number;
  }>;
}

export const IncomeChart = ({ data }: IncomeChartProps) => {
  return (
    <Card className="p-4">
      <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
        <BanknoteIcon className="w-4 h-4" />
        Three Month Income Comparison
      </h3>
      <div className="h-[345px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart 
            data={data || []}
            margin={{ top: 10, right: 30, left: 10, bottom: 40 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="month"
              height={60}
              interval={0}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickLine={false}
              axisLine={false}
              dy={16}
              label={{ 
                value: 'Months', 
                position: 'bottom', 
                offset: 20,
                style: { textAnchor: 'middle' }
              }}
            />
            <YAxis 
              label={{ 
                value: 'Income (₾)', 
                angle: -90, 
                position: 'insideLeft',
                offset: 0,
                style: { textAnchor: 'middle' }
              }}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickLine={false}
              axisLine={false}
              dx={-10}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              dataKey="income"
              fill="#82ca9d"
              name="Income (₾)"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};