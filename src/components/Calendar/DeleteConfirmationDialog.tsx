
import React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";
import { LanguageText } from "@/components/shared/LanguageText";
import { cn } from "@/lib/utils";

interface DeleteConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  eventTitle: string;
  isRecurring?: boolean;
  onDeleteSingle?: () => void;
  onDeleteSeries?: () => void;
}

export const DeleteConfirmationDialog = ({
  open,
  onOpenChange,
  onConfirm,
  eventTitle,
  isRecurring = false,
  onDeleteSingle,
  onDeleteSeries
}: DeleteConfirmationDialogProps) => {
  const { language, t } = useLanguage();
  const isGeorgian = language === 'ka';
  
  const georgianStyle = isGeorgian ? {
    fontFamily: "'BPG Glaho WEB Caps', 'DejaVu Sans', 'Arial Unicode MS', sans-serif",
    letterSpacing: '-0.2px',
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale'
  } : undefined;

  if (isRecurring && onDeleteSingle && onDeleteSeries) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className={cn("flex items-center gap-2", isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {isGeorgian ? (
                <GeorgianAuthText letterSpacing="-0.05px">განმეორებადი მოვლენის წაშლა</GeorgianAuthText>
              ) : (
                <LanguageText>{t("recurring.deleteRecurringEvent")}</LanguageText>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className={cn("text-muted-foreground", isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
              {isGeorgian ? (
                <GeorgianAuthText letterSpacing="-0.05px">
                  "{eventTitle}" არის განმეორებადი მოვლენა. რას გსურთ წაშლა?
                </GeorgianAuthText>
              ) : (
                <LanguageText>
                  "{eventTitle}" {t("recurring.isRecurringEvent")}
                </LanguageText>
              )}
            </p>

            <div className="flex flex-col gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  onDeleteSingle();
                  onOpenChange(false);
                }}
                className={cn("justify-start", isGeorgian ? "font-georgian" : "")}
                style={georgianStyle}
              >
                {isGeorgian ? (
                  <GeorgianAuthText letterSpacing="-0.05px">მხოლოდ ეს მოვლენა</GeorgianAuthText>
                ) : (
                  <LanguageText>{t("recurring.deleteThisEventOnly")}</LanguageText>
                )}
              </Button>
              
              <Button
                variant="destructive"
                onClick={() => {
                  onDeleteSeries();
                  onOpenChange(false);
                }}
                className={cn("justify-start", isGeorgian ? "font-georgian" : "")}
                style={georgianStyle}
              >
                {isGeorgian ? (
                  <GeorgianAuthText letterSpacing="-0.05px">მთელი სერია</GeorgianAuthText>
                ) : (
                  <LanguageText>{t("recurring.deleteEntireSeries")}</LanguageText>
                )}
              </Button>
            </div>
            
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className={cn("w-full", isGeorgian ? "font-georgian" : "")}
              style={georgianStyle}
            >
              {isGeorgian ? (
                <GeorgianAuthText letterSpacing="-0.05px">გაუქმება</GeorgianAuthText>
              ) : (
                <LanguageText>{t("common.cancel")}</LanguageText>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Regular single event deletion confirmation
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className={cn("flex items-center gap-2", isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {isGeorgian ? (
              <GeorgianAuthText letterSpacing="-0.05px">მოვლენის წაშლა</GeorgianAuthText>
            ) : (
              <LanguageText>Delete Event</LanguageText>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className={cn("text-muted-foreground", isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
            {isGeorgian ? (
              <GeorgianAuthText letterSpacing="-0.05px">
                ნამდვილად გსურთ "{eventTitle}" მოვლენის წაშლა?
              </GeorgianAuthText>
            ) : (
              `Are you sure you want to delete "${eventTitle}"?`
            )}
          </p>

          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className={cn(isGeorgian ? "font-georgian" : "")}
              style={georgianStyle}
            >
              {isGeorgian ? (
                <GeorgianAuthText letterSpacing="-0.05px">გაუქმება</GeorgianAuthText>
              ) : (
                <LanguageText>{t("common.cancel")}</LanguageText>
              )}
            </Button>
            
            <Button
              variant="destructive"
              onClick={() => {
                onConfirm();
                onOpenChange(false);
              }}
              className={cn(isGeorgian ? "font-georgian" : "")}
              style={georgianStyle}
            >
              {isGeorgian ? (
                <GeorgianAuthText letterSpacing="-0.05px">წაშლა</GeorgianAuthText>
              ) : (
                <LanguageText>{t("common.delete")}</LanguageText>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
