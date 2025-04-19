
import { toast as sonnerToast } from "sonner";

type ToastProps = {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
  duration?: number;
};

export function toast(props: ToastProps) {
  const { title, description, variant, duration, ...rest } = props;
  
  if (variant === "destructive") {
    return sonnerToast.error(title, {
      description,
      duration,
      ...rest
    });
  }
  
  return sonnerToast(title, {
    description,
    duration,
    ...rest
  });
}

export const useToast = () => {
  return {
    toast
  };
};
