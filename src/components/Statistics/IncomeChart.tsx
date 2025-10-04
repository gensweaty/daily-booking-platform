
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
import { useLanguage } from "@/contexts/LanguageContext";
import { es } from 'date-fns/locale';
import { format } from 'date-fns';

interface IncomeChartProps {
  data: Array<{
    month: string;
    income: number;
  }>;
}

export const IncomeChart = ({ data }: IncomeChartProps) => {
  const { language, t } = useLanguage();
  const isSpanish = language === 'es';
  
  // Transform data to use Spanish month names if needed
  const transformedData = data.map(item => {
    if (isSpanish) {
      // Extract month from the string (assuming format like "Jan 2024" or "Jan")
      const monthStr = item.month.split(' ')[0];
      // Map English month abbreviations to Spanish ones
      const monthMap: { [key: string]: string } = {
        'Jan': 'ene',
        'Feb': 'feb',
        'Mar': 'mar',
        'Apr': 'abr',
        'May': 'may',
        'Jun': 'jun',
        'Jul': 'jul',
        'Aug': 'ago',
        'Sep': 'sep',
        'Oct': 'oct',
        'Nov': 'nov',
        'Dec': 'dic'
      };
      
      return {
        ...item,
        month: monthMap[monthStr] || monthStr
      };
    }
    return item;
  });

  const title = data.length > 3 
    ? t('analytics.monthIncomeComparison', { months: data.length })
    : t('analytics.threeMonthIncomeComparison');

  const xAxisLabel = t('analytics.months');
  const yAxisLabel = t('analytics.income');

  return (
    <Card className="p-4">
      <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
        <BanknoteIcon className="w-4 h-4" />
        {title}
      </h3>
      <div className="h-[345px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart 
            data={transformedData || []}
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
                value: xAxisLabel, 
                position: 'bottom', 
                offset: 20,
                style: { textAnchor: 'middle' }
              }}
            />
            <YAxis 
              label={{ 
                value: yAxisLabel, 
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
              name={yAxisLabel}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};
