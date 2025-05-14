
import { useToast as useToastOriginal, toast as toastOriginal } from "@/components/ui/toast";

// Re-export with the same names
export const useToast = useToastOriginal;
export const toast = toastOriginal;
