import { Toast, ToastActionElement, ToastProps } from "@/components/ui/toast";
import {
  useToast as useToastOriginal,
  toast as toastOriginal
} from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

type ToastOptions = Partial<
  Pick<Toast, "id" | "title" | "description" | "action" | "variant">
> & {
  translateParams?: Record<string, string | number>;
};

// Create extension with specific types and functionality for the project
const createExtendedToast = (baseToast: typeof toastOriginal) => {
  // Base toast function stays the same
  const toast = (props: ToastOptions) => baseToast(props);
  
  // Add category-specific toast shortcuts
  toast.error = ({ title, ...props }: ToastOptions) => 
    baseToast({ 
      title: title || "Error", 
      variant: "destructive", 
      ...props 
    });
  
  // Add toast methods for specific events
  toast.event = {
    updated: () => baseToast({ 
      description: "Event updated successfully", 
      variant: "success"
    }),
    created: () => baseToast({ 
      description: "Event created successfully", 
      variant: "success" 
    }),
    deleted: () => baseToast({ 
      description: "Event deleted successfully", 
      variant: "default" 
    }),
    bookingSubmitted: () => baseToast({
      description: "Booking request submitted successfully",
      variant: "success"
    })
  };
  
  toast.task = {
    updated: () => baseToast({ 
      description: "Task updated successfully", 
      variant: "success" 
    }),
    created: () => baseToast({ 
      description: "Task created successfully", 
      variant: "success" 
    }),
    deleted: () => baseToast({ 
      description: "Task deleted successfully", 
      variant: "default" 
    }),
  };
  
  toast.note = {
    updated: () => baseToast({ 
      description: "Note updated successfully", 
      variant: "success" 
    }),
    created: () => baseToast({ 
      description: "Note created successfully", 
      variant: "success" 
    }),
    deleted: () => baseToast({ 
      description: "Note deleted successfully", 
      variant: "default" 
    }),
  };
  
  toast.reminder = {
    created: () => baseToast({ 
      description: "Reminder created successfully", 
      variant: "success" 
    }),
  };
  
  return toast;
};

// Create custom hook with language translation support
const useToast = () => {
  const { toast: baseToast, ...rest } = useToastOriginal();
  const { t } = useLanguage();
  
  // Create toast methods with translation support
  const toast = createExtendedToast((props) => {
    // Handle translation for title and description if they're keys
    let { title, description, translateParams } = props;
    
    // Try to translate the title if it looks like a translation key
    if (title && typeof title === 'string' && title.includes('.')) {
      try {
        const translatedTitle = t(title, translateParams);
        if (translatedTitle !== title) {
          title = translatedTitle;
        }
      } catch (e) {
        // If translation fails, keep the original title
      }
    }
    
    // Try to translate the description if it looks like a translation key
    if (description && typeof description === 'string' && description.includes('.')) {
      try {
        const translatedDescription = t(description, translateParams);
        if (translatedDescription !== description) {
          description = translatedDescription;
        }
      } catch (e) {
        // If translation fails, keep the original description
      }
    }
    
    return baseToast({ ...props, title, description });
  });
  
  return { toast, ...rest };
};

// Export both the hook and the toast function
export { useToast, createExtendedToast as toast };
