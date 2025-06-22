
import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface RecurringEventEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditChoice: (choice: 'this' | 'series') => void;
  eventTitle: string;
}

export const RecurringEventEditDialog = ({
  open,
  onOpenChange,
  onEditChoice,
  eventTitle
}: RecurringEventEditDialogProps) => {
  const handleChoice = (choice: 'this' | 'series') => {
    onEditChoice(choice);
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Edit Recurring Event</AlertDialogTitle>
          <AlertDialogDescription>
            "{eventTitle}" is a recurring event. Do you want to edit just this occurrence or the entire series?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => handleChoice('this')}>
            Edit this event only
          </AlertDialogAction>
          <AlertDialogAction onClick={() => handleChoice('series')}>
            Edit entire series
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
