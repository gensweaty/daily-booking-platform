
import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

interface RecurringDeleteDialogProps {
  open: boolean;
  isOpen?: boolean;
  onOpenChange: (open: boolean) => void;
  onClose?: () => void;
  onDeleteThis: () => void;
  onDeleteSeries: () => void;
  onConfirm?: (deleteChoice: "this" | "series") => Promise<void>;
  isRecurringEvent: boolean;
  isLoading?: boolean;
}

export const RecurringDeleteDialog = ({
  open,
  isOpen,
  onOpenChange,
  onClose,
  onDeleteThis,
  onDeleteSeries,
  onConfirm,
  isRecurringEvent,
  isLoading = false
}: RecurringDeleteDialogProps) => {
  const { t } = useLanguage();

  // Determine if dialog should be open
  const dialogOpen = open !== undefined ? open : (isOpen !== undefined ? isOpen : false);

  const handleClose = () => {
    if (onOpenChange) {
      onOpenChange(false);
    } else if (onClose) {
      onClose();
    }
  };

  const handleDeleteThis = () => {
    if (onConfirm) {
      onConfirm("this");
    } else {
      onDeleteThis();
    }
  };

  const handleDeleteSeries = () => {
    if (onConfirm) {
      onConfirm("series");
    } else {
      onDeleteSeries();
    }
  };

  if (!isRecurringEvent) {
    // For single events, show simple confirmation
    return (
      <Dialog open={dialogOpen} onOpenChange={handleClose}>
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
                onClick={handleClose}
                disabled={isLoading}
              >
                {t("common.cancel")}
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteThis}
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
    <Dialog open={dialogOpen} onOpenChange={handleClose}>
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
              onClick={handleDeleteThis}
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? t("common.loading") : t("recurring.deleteOnlyThis")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteSeries}
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? t("common.loading") : t("recurring.deleteWholeSeries")}
            </Button>
            <Button
              variant="ghost"
              onClick={handleClose}
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
