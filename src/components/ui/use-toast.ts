
import { useToast, toast } from "@/hooks/use-toast";

// Extend the existing toast.event object with bookingSubmitted
// without overriding the entire object
if (toast.event) {
  // We already have bookingSubmitted in the original implementation,
  // but if we need to override it or ensure it exists, we can do:
  const originalBookingSubmitted = toast.event.bookingSubmitted;
  
  toast.event.bookingSubmitted = () => toast({
    translateKeys: {
      titleKey: "bookings.requestSubmitted",
      descriptionKey: "bookings.requestSubmittedDescription"
    }
  });
}

export { useToast, toast };
