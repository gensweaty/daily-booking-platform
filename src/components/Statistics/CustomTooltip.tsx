
import { useLanguage } from "@/contexts/LanguageContext";

interface TooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
}

export const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
  const { language } = useLanguage();
  const isSpanish = language === 'es';

  if (active && payload && payload.length) {
    return (
      <div className="bg-background border border-border p-2 rounded-lg shadow-lg">
        <p className="text-sm font-medium">{label}</p>
        {payload.map((pld: any, index: number) => (
          <p key={index} className="text-sm">
            {pld.name === "Income ($)" || pld.name === "Ingresos ($)" ? 
              `${pld.name}: $${pld.value.toFixed(2)}` :
              `${pld.name}: ${pld.value}`
            }
          </p>
        ))}
      </div>
    );
  }
  return null;
};
