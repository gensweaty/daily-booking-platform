
import { useToast as useToastOriginal, toast as toastOriginal, type ToastOptions } from "@/components/ui/use-toast";

// Re-export with the same names
export const useToast = useToastOriginal;
export const toast = toastOriginal;
export type { ToastOptions };
