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
          <AlertDialogTitle>{t("events.recurringEditTitle")}</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel type="button" disabled={isLoading}>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction type="button" disabled={isLoading} onClick={onEditThis}>
            {t("events.onlyThisEvent")}
          </AlertDialogAction>
          <AlertDialogAction type="button" disabled={isLoading} onClick={onEditSeries}>
            {t("events.entireSeries")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};