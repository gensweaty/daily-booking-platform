
// This is a re-export file to maintain backward compatibility

import { useToast as useToastHook, type ToastOptions } from "@/hooks/use-toast";

export const useToast = useToastHook;

export type { ToastOptions };

// Export a function as toast to maintain compatibility with the old API
// This is needed for non-component imports like "import { toast } from '@/components/ui/use-toast'"
export const toast = useToastHook().toast;
