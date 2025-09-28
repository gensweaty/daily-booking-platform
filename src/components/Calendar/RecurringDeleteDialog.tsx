
import React from "react";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogFooter, AlertDialogCancel, AlertDialogAction
} from "@/components/ui/alert-dialog";
import { useLanguage } from "@/contexts/LanguageContext";

interface RecurringDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleteThis: () => void;
  onDeleteSeries: () => void;
  isRecurringEvent: boolean;
  isLoading?: boolean;
}

export const RecurringDeleteDialog = ({
  open,
  onOpenChange,
  onDeleteThis,
  onDeleteSeries,
  isRecurringEvent,
  isLoading = false
}: RecurringDeleteDialogProps) => {
  const { t } = useLanguage();

  if (!isRecurringEvent) {
    // For single events, show simple confirmation
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("events.deleteEventConfirmTitle")}</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={isLoading}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction type="button" disabled={isLoading} onClick={onDeleteThis} className="bg-destructive hover:bg-destructive/90">
              {isLoading ? t("common.loading") : t("events.deleteEvent")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // For recurring events, show series/single choice
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("events.recurringDeleteTitle")}</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel type="button" disabled={isLoading}>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction type="button" disabled={isLoading} onClick={onDeleteThis}>
            {t("events.onlyThisEvent")}
          </AlertDialogAction>
          <AlertDialogAction type="button" disabled={isLoading} onClick={onDeleteSeries} className="bg-destructive hover:bg-destructive/90">
            {t("events.entireSeries")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
