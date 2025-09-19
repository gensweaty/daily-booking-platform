import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("recurring.editEventTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("recurring.editEventBody")}
          </p>
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              onClick={onEditThis}
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? t("common.loading") : t("recurring.editOnlyThis")}
            </Button>
            <Button
              variant="default"
              onClick={onEditSeries}
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? t("common.loading") : t("recurring.editWholeSeries")}
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