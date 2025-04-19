
import { toast as sonnerToast, type Toast } from "sonner";

type ToastProps = Toast & {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
};

export function toast(props: ToastProps) {
  const { title, description, variant, ...rest } = props;
  
  if (variant === "destructive") {
    return sonnerToast.error(title, {
      description,
      ...rest
    });
  }
  
  return sonnerToast(title, {
    description,
    ...rest
  });
}

export const useToast = () => {
  return {
    toast
  };
};
