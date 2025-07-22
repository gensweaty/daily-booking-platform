
import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("events.deleteEventConfirmTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("events.deleteEventConfirmMessage")}
            </p>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                {t("common.cancel")}
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  console.log('[RecurringDeleteDialog] Triggering atomic delete for single event');
                  onDeleteThis();
                }}
                disabled={isLoading}
              >
                {isLoading ? t("common.loading") : t("events.deleteEvent")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // For recurring events, show series/single choice
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("recurring.deleteEventTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("recurring.deleteEventBody")}
          </p>
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              onClick={() => {
                console.log('[RecurringDeleteDialog] Triggering atomic delete for single recurring instance');
                onDeleteThis();
              }}
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? t("common.loading") : t("recurring.deleteOnlyThis")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                console.log('[RecurringDeleteDialog] Triggering atomic delete for entire recurring series');
                onDeleteSeries();
              }}
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? t("common.loading") : t("recurring.deleteWholeSeries")}
            </Button>
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="w-full"
              disabled={isLoading}
            >
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
