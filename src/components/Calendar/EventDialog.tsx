import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { CalendarEventType } from "@/lib/types/calendar";
import { FileInput } from "@/components/ui/file-input";
import { TimeConflictDialog } from "./TimeConflictDialog";
import { checkTimeConflicts, checkBookingConflicts } from "@/utils/timeConflictChecker";
import { useOptimizedCalendarEvents } from "@/hooks/useOptimizedCalendarEvents";
import { useBookingRequests } from "@/hooks/useBookingRequests";

const formSchema = z.object({
  title: z.string().min(2, {
    message: "Title must be at least 2 characters.",
  }),
  startDate: z.string().min(1, {
    message: "Start date is required.",
  }),
  endDate: z.string().min(1, {
    message: "End date is required.",
  }),
  userNumber: z.string().optional(),
  socialNetworkLink: z.string().optional(),
  eventNotes: z.string().optional(),
  paymentStatus: z.string().optional(),
  paymentAmount: z.string().optional(),
  file: z.any().optional(),
});

interface EventDialogProps {
  selectedEvent: CalendarEventType | null;
  onClose: () => void;
  isOpen: boolean;
  selectedDate: Date | undefined;
  onEventCreate?: (data: Partial<CalendarEventType>) => Promise<CalendarEventType | void>;
  onEventUpdate?: (data: Partial<CalendarEventType>) => Promise<CalendarEventType | void>;
  onEventDelete?: (id: string) => Promise<void>;
}

export const EventDialog = ({ 
  selectedEvent, 
  onClose, 
  isOpen, 
  selectedDate,
  onEventCreate,
  onEventUpdate,
  onEventDelete
}: EventDialogProps) => {
  const [date, setDate] = useState<Date | undefined>(selectedDate);
  const { user } = useAuth();
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [conflictingEvents, setConflictingEvents] = useState<any[]>([]);
  const [pendingSubmission, setPendingSubmission] = useState<any>(null);

  // Get calendar data for conflict checking
  const { data: calendarData } = useOptimizedCalendarEvents(user?.id, selectedDate || new Date());
  const { approvedRequests } = useBookingRequests();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: selectedEvent?.title || "",
      startDate: selectedEvent?.start_date || selectedDate?.toISOString() || "",
      endDate: selectedEvent?.end_date || selectedDate?.toISOString() || "",
      userNumber: selectedEvent?.user_number || "",
      socialNetworkLink: selectedEvent?.social_network_link || "",
      eventNotes: selectedEvent?.event_notes || "",
      paymentStatus: selectedEvent?.payment_status || "not_paid",
      paymentAmount: selectedEvent?.payment_amount?.toString() || "",
    },
  });

  function disabled(date: Date): boolean {
    if (!selectedDate) {
      return false;
    }
    return date < selectedDate;
  }

  const handleDateChange = (newDate: Date | undefined) => {
    setDate(newDate);
    if (newDate) {
      form.setValue("startDate", newDate.toISOString());
      form.setValue("endDate", newDate.toISOString());
    }
  };

  const checkForConflicts = (formData: any) => {
    if (!user?.id) return { hasConflicts: false, conflicts: [] };

    const startDate = formData.startDate;
    const endDate = formData.endDate;

    if (!startDate || !endDate) return { hasConflicts: false, conflicts: [] };

    // Transform optimized data to match CalendarEventType interface
    const transformedEvents = [
      ...(calendarData?.events || []).map(event => ({
        ...event,
        created_at: event.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(), // Add missing updated_at
        user_id: event.user_id,
        type: event.type || 'event'
      } as CalendarEventType)),
      ...(calendarData?.bookingRequests || []).map(booking => ({
        ...booking,
        created_at: booking.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(), // Add missing updated_at
        user_id: booking.business_id, // Map business_id to user_id
        type: 'booking_request'
      } as CalendarEventType))
    ];

    // Check conflicts with calendar events
    const eventConflicts = checkTimeConflicts(
      startDate,
      endDate,
      transformedEvents,
      selectedEvent?.id // Exclude current event when editing
    );

    // Check conflicts with approved bookings (separate check for booking requests)
    const bookingConflicts = checkBookingConflicts(
      startDate,
      endDate,
      approvedRequests || []
    );

    // Combine all conflicts
    const allConflicts = [
      ...eventConflicts.conflicts,
      ...bookingConflicts.conflicts
    ];

    return {
      hasConflicts: allConflicts.length > 0,
      conflicts: allConflicts
    };
  };

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    try {
      // Check for time conflicts
      const conflictCheck = checkForConflicts(data);
      
      if (conflictCheck.hasConflicts) {
        setConflictingEvents(conflictCheck.conflicts);
        setPendingSubmission(data);
        setShowConflictDialog(true);
        return; // Don't proceed with submission
      }

      // No conflicts, proceed with normal submission
      await proceedWithSubmission(data);
    } catch (error) {
      console.error('Error submitting event:', error);
    }
  };

  const proceedWithSubmission = async (data: z.infer<typeof formSchema>) => {
    try {
      const startDateTime = data.startDate;
      const endDateTime = data.endDate;

      const eventData = {
        title: data.title,
        user_surname: data.title,
        user_number: data.userNumber,
        social_network_link: data.socialNetworkLink,
        event_notes: data.eventNotes,
        start_date: startDateTime,
        end_date: endDateTime,
        payment_status: data.paymentStatus,
        payment_amount: data.paymentAmount ? Number(data.paymentAmount) : undefined,
        file: data.file,
      };

      if (selectedEvent) {
        console.log("Updating existing event:", selectedEvent.id);
        await onEventUpdate?.(eventData);
      } else {
        console.log("Creating new event");
        await onEventCreate?.(eventData);
      }
      
      onClose();
    } catch (error) {
      console.error('Error in event submission:', error);
    }
  };

  const handleConflictProceed = async () => {
    setShowConflictDialog(false);
    if (pendingSubmission) {
      await proceedWithSubmission(pendingSubmission);
      setPendingSubmission(null);
    }
  };

  const handleConflictCancel = () => {
    setShowConflictDialog(false);
    setPendingSubmission(null);
    setConflictingEvents([]);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>{selectedEvent ? "Edit Event" : "Create Event"}</DialogTitle>
            <DialogDescription>
              {selectedEvent
                ? "Make changes to your event here. Click save when you're done."
                : "Create a new event here. Click save when you're done."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Event title" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex items-center space-x-2">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>Start Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-[240px] pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(new Date(field.value), "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={date}
                            onSelect={handleDateChange}
                            disabled={disabled}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>End Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-[240px] pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(new Date(field.value), "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={date}
                            onSelect={handleDateChange}
                            disabled={disabled}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="userNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>User Number</FormLabel>
                    <FormControl>
                      <Input placeholder="User number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="socialNetworkLink"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Social Network Link</FormLabel>
                    <FormControl>
                      <Input placeholder="Social network link" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="eventNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Event notes"
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="paymentStatus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a payment status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="not_paid">Not Paid</SelectItem>
                        <SelectItem value="partly_paid">Partly Paid</SelectItem>
                        <SelectItem value="fully_paid">Fully Paid</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="paymentAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Amount</FormLabel>
                    <FormControl>
                      <Input placeholder="Payment amount" type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="file"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Attachment</FormLabel>
                    <FormControl>
                      <FileInput onChange={(file) => field.onChange(file)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit">{selectedEvent ? "Update" : "Save"}</Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <TimeConflictDialog
        isOpen={showConflictDialog}
        onClose={handleConflictCancel}
        onProceed={handleConflictProceed}
        conflicts={conflictingEvents}
        mode="warning"
        title="Schedule Conflict Warning"
      />
    </>
  );
};
