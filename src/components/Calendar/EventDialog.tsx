
import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { EventDialogFields } from "./EventDialogFields";
import { AlertCircle, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "../shared/LanguageText";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";

export const EventDialog = ({ event, isOpen, onClose }) => {
  const [eventData, setEventData] = useState(event || {});
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileError, setFileError] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const { updateEvent, deleteEvent } = useCalendarEvents();

  const isNewEvent = !event?.id;
  
  useEffect(() => {
    if (event) {
      setEventData(event);
    }
  }, [event]);

  const handleDeleteEvent = async () => {
    try {
      await deleteEvent(event.id);
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast({
        title: t("common.success"),
        description: t("events.eventDeleted"),
      });
      onClose();
      setIsDeleteConfirmOpen(false);
    } catch (error) {
      console.error("Error deleting event:", error);
      toast({
        title: t("common.error"),
        description: error.message || t("common.errorOccurred"),
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (!eventData.title || !eventData.start || !eventData.end) {
        toast({
          title: t("common.error"),
          description: t("common.missingUserInfo"),
          variant: "destructive",
        });
        return;
      }

      const start = new Date(eventData.start);
      const end = new Date(eventData.end);

      if (start >= end) {
        toast({
          title: t("common.error"),
          description: t("events.timeSlotConflict"),
          variant: "destructive",
        });
        return;
      }

      if (isNewEvent) {
        // const newEvent = await createEvent(eventData);
        // setEventData(newEvent);
        toast({
          title: t("common.warning"),
          description: "Creating events is not yet implemented.",
        });
        onClose();
      } else {
        await updateEvent({
          ...eventData,
          id: event.id
        });
        toast({
          title: t("common.success"),
          description: t("events.eventUpdated"),
        });
        onClose();
      }

      queryClient.invalidateQueries({ queryKey: ['events'] });
    } catch (error) {
      console.error("Error creating/updating event:", error);
      toast({
        title: t("common.error"),
        description: error.message || t("common.errorOccurred"),
        variant: "destructive",
      });
    }
  };

  const handleDeleteClick = () => {
    setIsDeleteConfirmOpen(true);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[425px] bg-background">
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">
                {isNewEvent ? (
                  <LanguageText>{t("events.addNewEvent")}</LanguageText>
                ) : (
                  <LanguageText>{t("events.editEvent")}</LanguageText>
                )}
              </h2>
              {!isNewEvent && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteClick}
                  className="flex items-center gap-1"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <form onSubmit={handleSubmit}>
              <EventDialogFields
                eventData={eventData}
                setEventData={setEventData}
                selectedFile={selectedFile}
                setSelectedFile={setSelectedFile}
                fileError={fileError}
                setFileError={setFileError}
              />
              <div className="flex justify-end mt-4">
                <Button type="submit" className="w-full">
                  {isNewEvent ? (
                    <LanguageText>{t("events.createEvent")}</LanguageText>
                  ) : (
                    <LanguageText>{t("events.updateEvent")}</LanguageText>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              {t("events.deleteEvent")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("common.deleteConfirmMessage")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEvent} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
