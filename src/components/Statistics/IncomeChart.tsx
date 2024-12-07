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
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
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