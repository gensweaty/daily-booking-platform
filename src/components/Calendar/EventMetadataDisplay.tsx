
import React from 'react';
import { Calendar, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { useLanguage } from '@/contexts/LanguageContext';

interface EventMetadataDisplayProps {
  createdAt: string | Date;
  updatedAt: string | Date;
}

export const EventMetadataDisplay = ({ createdAt, updatedAt }: EventMetadataDisplayProps) => {
  const { t } = useLanguage();

  const formatDate = (date: string | Date) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, "MMM dd, yyyy 'at' HH:mm");
  };

  return (
    <div className="p-4 rounded-lg border border-input bg-muted/50">
      <div className="space-y-2">
        <div className="flex items-center text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground mr-2" />
          <span className="text-muted-foreground">{t("events.createdAtLabel")}</span>
          <span className="ml-1 text-foreground/80">{formatDate(createdAt)}</span>
        </div>
        <div className="flex items-center text-sm">
          <Clock className="h-4 w-4 text-muted-foreground mr-2" />
          <span className="text-muted-foreground">{t("events.lastUpdatedLabel")}</span>
          <span className="ml-1 text-foreground/80">{formatDate(updatedAt)}</span>
        </div>
      </div>
    </div>
  );
};
