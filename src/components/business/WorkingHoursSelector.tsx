import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "@/components/shared/LanguageText";
import { Clock } from "lucide-react";
import { 
  WorkingHoursConfig, 
  DayOfWeek, 
  DAYS_OF_WEEK, 
  DEFAULT_WORKING_HOURS 
} from "@/types/workingHours";

interface WorkingHoursSelectorProps {
  value: WorkingHoursConfig | null;
  onChange: (value: WorkingHoursConfig) => void;
}

// Generate time options from 00:00 to 23:00
const TIME_OPTIONS = Array.from({ length: 24 }, (_, i) => {
  const hour = i.toString().padStart(2, '0');
  return `${hour}:00`;
});

export const WorkingHoursSelector = ({ value, onChange }: WorkingHoursSelectorProps) => {
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';
  
  // Initialize with default or provided value
  const [config, setConfig] = useState<WorkingHoursConfig>(
    value || DEFAULT_WORKING_HOURS
  );

  // Update parent when config changes
  useEffect(() => {
    onChange(config);
  }, [config, onChange]);

  // Update local state when value prop changes
  useEffect(() => {
    if (value) {
      setConfig(value);
    }
  }, [value]);

  const handleEnabledChange = (enabled: boolean) => {
    setConfig(prev => ({ ...prev, enabled }));
  };

  const handleDayEnabledChange = (day: DayOfWeek, enabled: boolean) => {
    setConfig(prev => ({
      ...prev,
      days: {
        ...prev.days,
        [day]: { ...prev.days[day], enabled },
      },
    }));
  };

  const handleTimeChange = (day: DayOfWeek, type: 'start' | 'end', time: string) => {
    setConfig(prev => ({
      ...prev,
      days: {
        ...prev.days,
        [day]: { ...prev.days[day], [type]: time },
      },
    }));
  };

  const getDayLabel = (day: DayOfWeek): string => {
    const labels: Record<DayOfWeek, { en: string; ka: string }> = {
      monday: { en: "Monday", ka: "ორშაბათი" },
      tuesday: { en: "Tuesday", ka: "სამშაბათი" },
      wednesday: { en: "Wednesday", ka: "ოთხშაბათი" },
      thursday: { en: "Thursday", ka: "ხუთშაბათი" },
      friday: { en: "Friday", ka: "პარასკევი" },
      saturday: { en: "Saturday", ka: "შაბათი" },
      sunday: { en: "Sunday", ka: "კვირა" },
    };
    return isGeorgian ? labels[day].ka : labels[day].en;
  };

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">
              <LanguageText>{t("business.workingHours")}</LanguageText>
            </CardTitle>
          </div>
          <Switch
            checked={config.enabled}
            onCheckedChange={handleEnabledChange}
            aria-label="Enable working hours"
          />
        </div>
        <CardDescription>
          <LanguageText>{t("business.workingHoursDescription")}</LanguageText>
        </CardDescription>
      </CardHeader>
      
      {config.enabled && (
        <CardContent className="space-y-3">
          {DAYS_OF_WEEK.map((day) => (
            <div
              key={day}
              className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 rounded-lg transition-colors ${
                config.days[day].enabled 
                  ? 'bg-primary/5 border border-primary/20' 
                  : 'bg-muted/50'
              }`}
            >
              <div className="flex items-center gap-3 min-w-[140px]">
                <Switch
                  checked={config.days[day].enabled}
                  onCheckedChange={(checked) => handleDayEnabledChange(day, checked)}
                  aria-label={`Enable ${day}`}
                />
                <Label 
                  className={`font-medium ${!config.days[day].enabled ? 'text-muted-foreground' : ''}`}
                  style={isGeorgian ? { fontFamily: "'BPG Glaho WEB Caps', sans-serif" } : undefined}
                >
                  {getDayLabel(day)}
                </Label>
              </div>

              {config.days[day].enabled && (
                <div className="flex items-center gap-2 ml-0 sm:ml-auto">
                  <Select
                    value={config.days[day].start}
                    onValueChange={(time) => handleTimeChange(day, 'start', time)}
                  >
                    <SelectTrigger className="w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map((time) => (
                        <SelectItem key={`${day}-start-${time}`} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <span className="text-muted-foreground">-</span>
                  
                  <Select
                    value={config.days[day].end}
                    onValueChange={(time) => handleTimeChange(day, 'end', time)}
                  >
                    <SelectTrigger className="w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map((time) => (
                        <SelectItem key={`${day}-end-${time}`} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {!config.days[day].enabled && (
                <span className="text-sm text-muted-foreground ml-0 sm:ml-auto">
                  <LanguageText>{t("business.closed")}</LanguageText>
                </span>
              )}
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
};
