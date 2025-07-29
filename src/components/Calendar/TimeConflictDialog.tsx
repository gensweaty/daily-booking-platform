
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ConflictingEvent } from "@/utils/timeConflictChecker";
import { format, parseISO } from "date-fns";
import { AlertTriangle } from "lucide-react";

interface TimeConflictDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onProceed: () => void;
  conflicts: ConflictingEvent[];
  mode: 'warning' | 'error'; // warning allows proceeding, error blocks action
  title?: string;
}

export const TimeConflictDialog: React.FC<TimeConflictDialogProps> = ({
  isOpen,
  onClose,
  onProceed,
  conflicts,
  mode,
  title = "Time Conflict Detected"
}) => {
  const formatDateTime = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'MMM dd, yyyy HH:mm');
    } catch (error) {
      return dateString;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {mode === 'warning' 
              ? 'The selected time conflicts with existing events. You can still proceed if needed.'
              : 'The selected time conflicts with existing events. Please choose a different time.'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-60 overflow-y-auto">
          <div className="space-y-3">
            {conflicts.map((conflict) => (
              <div key={conflict.id} className="border rounded-lg p-3 bg-gray-50 dark:bg-gray-800">
                <div className="font-medium">{conflict.title}</div>
                <div className="text-sm text-muted-foreground">
                  {formatDateTime(conflict.start_date)} - {formatDateTime(conflict.end_date)}
                </div>
                <div className="text-xs text-muted-foreground capitalize">
                  {conflict.type.replace('_', ' ')}
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {mode === 'warning' && (
            <Button onClick={onProceed} variant="destructive">
              Proceed Anyway
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
