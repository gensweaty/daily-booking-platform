
import React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "@/components/shared/LanguageText";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";

interface DeleteConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmDelete: () => void;
  onDeleteSingle?: () => void;
  onDeleteSeries?: () => void;
  eventTitle: string;
  isRecurringEvent?: boolean;
}

export const DeleteConfirmationDialog = ({
  open,
  onOpenChange,
  onConfirmDelete,
  onDeleteSingle,
  onDeleteSeries,
  eventTitle,
  isRecurringEvent = false
}: DeleteConfirmationDialogProps) => {
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';

  const georgianStyle = isGeorgian ? {
    fontFamily: "'BPG Glaho WEB Caps', 'DejaVu Sans', 'Arial Unicode MS', sans-serif",
    letterSpacing: '-0.2px',
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale'
  } : undefined;

  if (isRecurringEvent && onDeleteSingle && onDeleteSeries) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className={isGeorgian ? "font-georgian" : ""} style={georgianStyle}>
              <LanguageText>{t("recurring.deleteRecurringEvent")}</LanguageText>
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className={isGeorgian ? "font-georgian" : ""} style={georgianStyle}>
              "<strong>{eventTitle}</strong>" <LanguageText>{t("recurring.isRecurringEvent")}</LanguageText>
            </p>
          </div>
          <DialogFooter className="flex flex-col gap-2 sm:flex-col sm:space-x-0">
            <Button
              onClick={() => {
                onDeleteSingle();
                onOpenChange(false);
              }}
              variant="outline"
              className={isGeorgian ? "font-georgian" : ""}
              style={georgianStyle}
            >
              <LanguageText>{t("recurring.deleteThisEventOnly")}</LanguageText>
            </Button>
            <Button
              onClick={() => {
                onDeleteSeries();
                onOpenChange(false);
              }}
              variant="destructive"
              className={isGeorgian ? "font-georgian" : ""}
              style={georgianStyle}
            >
              <LanguageText>{t("recurring.deleteEntireSeries")}</LanguageText>
            </Button>
            <Button
              onClick={() => onOpenChange(false)}
              variant="ghost"
              className={isGeorgian ? "font-georgian" : ""}
              style={georgianStyle}
            >
              <LanguageText>{t("common.cancel")}</LanguageText>  
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className={isGeorgian ? "font-georgian" : ""} style={georgianStyle}>
            {isGeorgian ? (
              <GeorgianAuthText>მოვლენის წაშლა</GeorgianAuthText>
            ) : (
              <LanguageText>Delete Event</LanguageText>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p className={isGeorgian ? "font-georgian" : ""} style={georgianStyle}>
            {isGeorgian ? (
              <GeorgianAuthText>დარწმუნებული ხართ, რომ გსურთ "<strong>{eventTitle}</strong>"-ის წაშლა?</GeorgianAuthText>
            ) : (
              <>Are you sure you want to delete "<strong>{eventTitle}</strong>"?</>
            )}
          </p>
        </div>
        <DialogFooter>
          <Button
            onClick={() => onOpenChange(false)}
            variant="outline"
            className={isGeorgian ? "font-georgian" : ""}
            style={georgianStyle}
          >
            <LanguageText>{t("common.cancel")}</LanguageText>
          </Button>
          <Button
            onClick={() => {
              onConfirmDelete();
              onOpenChange(false);
            }}
            variant="destructive"
            className={isGeorgian ? "font-georgian" : ""}
            style={georgianStyle}
          >
            <LanguageText>{t("common.delete")}</LanguageText>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
