
import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { format, getDay, endOfYear } from 'date-fns';
import { RecurringPattern, createRecurringPattern, getRecurringPatternDescription } from '@/lib/recurringEvents';
import { useLanguage } from '@/contexts/LanguageContext';

interface RecurringEventFieldsProps {
  startDate: string;
  repeatPattern: string;
  repeatUntil: string;
  onRepeatPatternChange: (pattern: string, until: string) => void;
}

export const RecurringEventFields = ({
  startDate,
  repeatPattern,
  repeatUntil,
  onRepeatPatternChange
}: RecurringEventFieldsProps) => {
  const { t } = useLanguage();
  const [selectedType, setSelectedType] = useState<string>('none');
  const [customRepeatUntil, setCustomRepeatUntil] = useState('');

  useEffect(() => {
    if (repeatPattern) {
      try {
        const pattern = JSON.parse(repeatPattern);
        setSelectedType(pattern.type || 'none');
      } catch {
        setSelectedType('none');
      }
    }
    
    if (repeatUntil) {
      setCustomRepeatUntil(repeatUntil);
    } else if (startDate) {
      // Default to end of current year
      const yearEnd = endOfYear(new Date(startDate));
      setCustomRepeatUntil(format(yearEnd, 'yyyy-MM-dd'));
    }
  }, [repeatPattern, repeatUntil, startDate]);

  const handleTypeChange = (type: string) => {
    setSelectedType(type);
    
    if (type === 'none') {
      onRepeatPatternChange('', '');
      return;
    }

    const startDateObj = new Date(startDate);
    const pattern = createRecurringPattern(type as RecurringPattern['type'], startDateObj);
    const until = customRepeatUntil || format(endOfYear(startDateObj), 'yyyy-MM-dd');
    
    onRepeatPatternChange(JSON.stringify(pattern), until);
  };

  const handleUntilChange = (until: string) => {
    setCustomRepeatUntil(until);
    
    if (selectedType !== 'none') {
      onRepeatPatternChange(repeatPattern, until);
    }
  };

  const getRepeatOptions = () => {
    const startDateObj = new Date(startDate);
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentWeekday = weekdays[getDay(startDateObj)];

    return [
      { value: 'none', label: 'Does not repeat' },
      { value: 'daily', label: 'Daily' },
      { value: 'weekly', label: `Weekly on ${currentWeekday}` },
      { value: 'monthly', label: `Monthly on ${format(startDateObj, 'do')}` },
      { value: 'yearly', label: `Annually on ${format(startDateObj, 'MMMM do')}` }
    ];
  };

  const getCurrentDescription = () => {
    if (selectedType === 'none' || !startDate) return '';
    
    try {
      const pattern = JSON.parse(repeatPattern);
      return getRecurringPatternDescription(pattern, new Date(startDate));
    } catch {
      return '';
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="repeat-type">Repeat</Label>
        <Select value={selectedType} onValueChange={handleTypeChange}>
          <SelectTrigger>
            <SelectValue placeholder="Does not repeat" />
          </SelectTrigger>
          <SelectContent>
            {getRepeatOptions().map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {getCurrentDescription() && (
          <p className="text-sm text-muted-foreground">
            {getCurrentDescription()}
          </p>
        )}
      </div>

      {selectedType !== 'none' && (
        <div className="space-y-2">
          <Label htmlFor="repeat-until">Repeat until</Label>
          <Input
            id="repeat-until"
            type="date"
            value={customRepeatUntil}
            onChange={(e) => handleUntilChange(e.target.value)}
            max={format(endOfYear(new Date()), 'yyyy-MM-dd')}
          />
          <p className="text-xs text-muted-foreground">
            Recurring events are limited to the current calendar year
          </p>
        </div>
      )}
    </div>
  );
};
