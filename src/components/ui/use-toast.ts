
import { Toast, ToastActionElement, ToastProps } from "@/components/ui/toast"

type ToastOptions = {
  title?: string;
  description?: string;
  action?: ToastActionElement;
  variant?: "default" | "destructive";
  translateParams?: Record<string, string | number>;
};

const useToast = () => {
  const notification = (options: ToastOptions) => {
    const { ...props } = options;
    return { ...props };
  };

  const error = (options: ToastOptions) => {
    return notification({ ...options, variant: "destructive" });
  };

  // Predefined toast variants for common actions
  const toast = {
    notification,
    error,
    task: {
      created: () => notification({ 
        title: "Task created", 
        description: "Your task has been created successfully" 
      }),
      updated: () => notification({ 
        title: "Task updated", 
        description: "Your task has been updated successfully" 
      }),
    },
    reminder: {
      created: () => notification({ 
        title: "Reminder created", 
        description: "Your reminder has been created successfully" 
      }),
    },
    note: {
      added: () => notification({ 
        title: "Note added", 
        description: "Your note has been added successfully" 
      }),
    },
  };

  return { toast };
};

const toast = (props: ToastProps) => {
  return props;
};

export { useToast, toast };
