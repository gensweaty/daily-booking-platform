
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

interface RecurringEventDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleteChoice: (choice: 'this' | 'series') => void;
  eventTitle: string;
}

export const RecurringEventDeleteDialog = ({
  open,
  onOpenChange,
  onDeleteChoice,
  eventTitle
}: RecurringEventDeleteDialogProps) => {
  const handleChoice = (choice: 'this' | 'series') => {
    onDeleteChoice(choice);
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Recurring Event</AlertDialogTitle>
          <AlertDialogDescription>
            "{eventTitle}" is a recurring event. Do you want to delete just this occurrence or the entire series?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={() => handleChoice('this')}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete this event only
          </AlertDialogAction>
          <AlertDialogAction 
            onClick={() => handleChoice('series')}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete entire series
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
