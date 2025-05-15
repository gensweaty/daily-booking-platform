
import { useToast, toast } from "@/hooks/use-toast";

// Add a helper for booking event submission messages
toast.event = {
  bookingSubmitted: () => toast({
    translateKeys: {
      titleKey: "bookings.requestSubmitted",
      descriptionKey: "bookings.requestSubmittedDescription"
    }
  })
};

export { useToast, toast };
