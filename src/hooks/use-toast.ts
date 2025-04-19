
import { toast as sonnerToast, type ToastT } from "sonner";

type ToastProps = {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  variant?: "default" | "destructive";
  duration?: number;
};

export function toast({
  title,
  description,
  action,
  variant,
  duration = 5000, // Default duration to 5 seconds
}: ToastProps) {
  sonnerToast(title, {
    description,
    action,
    className: variant === "destructive" ? "border-destructive" : "",
    duration: duration,
  });
}

type UseToastReturnType = {
  toast: (props: ToastProps) => void;
};

export const useToast = (): UseToastReturnType => {
  return { toast };
};
