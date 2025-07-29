
import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { format } from 'date-fns';

interface TimeConflict {
  event_id: string;
  event_title: string;
  event_start: string;
  event_end: string;
  event_type: string;
}

interface ConflictWarningProps {
  conflicts: TimeConflict[];
  className?: string;
}

export const ConflictWarning: React.FC<ConflictWarningProps> = ({
  conflicts,
  className = ""
}) => {
  if (conflicts.length === 0) return null;

  return (
    <Alert variant="destructive" className={className}>
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>
        <div className="space-y-2">
          <div className="font-medium">
            Time conflict detected with existing events:
          </div>
          <ul className="list-disc list-inside space-y-1 text-sm">
            {conflicts.map((conflict, index) => (
              <li key={`${conflict.event_id}-${index}`}>
                <span className="font-medium">"{conflict.event_title}"</span>
                <span className="text-muted-foreground ml-1">
                  ({format(new Date(conflict.event_start), 'MMM d, HH:mm')} - {format(new Date(conflict.event_end), 'HH:mm')})
                </span>
                {conflict.event_type === 'booking_request' && (
                  <span className="text-green-600 ml-1">(Booking Request)</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </AlertDescription>
    </Alert>
  );
};
