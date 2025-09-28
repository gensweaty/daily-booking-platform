import React from "react";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogFooter, AlertDialogCancel, AlertDialogAction
} from "@/components/ui/alert-dialog";
import { useLanguage } from "@/contexts/LanguageContext";

interface RecurringEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditThis: () => void;
  onEditSeries: () => void;
  isRecurringEvent: boolean;
  isLoading?: boolean;
}

export const RecurringEditDialog = ({
  open,
  onOpenChange,
  onEditThis,
  onEditSeries,
  isRecurringEvent,
  isLoading = false
}: RecurringEditDialogProps) => {
  const { t } = useLanguage();

  if (!isRecurringEvent) {
    // For single events, no dialog needed - proceed directly to edit
    return null;
  }

  // For recurring events, show series/single choice
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Apply changes to…</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={isLoading} onClick={onEditThis}>Only this event</AlertDialogAction>
          <AlertDialogAction disabled={isLoading} onClick={onEditSeries}>Entire series</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};