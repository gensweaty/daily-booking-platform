
import { Toast as ToastPrimitive, ToastActionElement, ToastProps } from "@/components/ui/toast";
import * as React from "react";
import { useLanguage } from "@/contexts/LanguageContext";

// Define types
const TOAST_LIMIT = 10;
const TOAST_REMOVE_DELAY = 1000000;

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
  translateParams?: Record<string, string | number>;
  duration?: number;
};

export type ToastOptions = Partial<
  Pick<ToasterToast, "id" | "title" | "description" | "action" | "variant" | "duration">
> & {
  translateParams?: Record<string, string | number>;
  translateKeys?: {
    titleKey?: string;
    descriptionKey?: string;
  };
};

// Create unique toast ID
const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const;

let count = 0;

function genId() {
  count = (count + 1) % Number.MAX_VALUE;
  return count.toString();
}

// Toast reducer
type ActionType = typeof actionTypes;

type Action =
  | {
      type: ActionType["ADD_TOAST"];
      toast: ToasterToast;
    }
  | {
      type: ActionType["UPDATE_TOAST"];
      toast: Partial<ToasterToast>;
    }
  | {
      type: ActionType["DISMISS_TOAST"];
      toastId?: string;
    }
  | {
      type: ActionType["REMOVE_TOAST"];
      toastId?: string;
    };

interface State {
  toasts: ToasterToast[];
}

function toastReducer(state: State, action: Action): State {
  switch (action.type) {
    case actionTypes.ADD_TOAST:
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      };

    case actionTypes.UPDATE_TOAST:
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      };

    case actionTypes.DISMISS_TOAST:
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toastId || action.toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t
        ),
      };

    case actionTypes.REMOVE_TOAST:
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        };
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      };
    default:
      return state;
  }
}

// Toast hook implementation
export function useToast() {
  const [state, dispatch] = React.useReducer(toastReducer, {
    toasts: [],
  });
  const { t } = useLanguage();

  React.useEffect(() => {
    state.toasts.forEach((t) => {
      if (t.open === false && t.id) {
        setTimeout(() => {
          dispatch({
            type: actionTypes.REMOVE_TOAST,
            toastId: t.id,
          });
        }, TOAST_REMOVE_DELAY);
      }
    });
  }, [state.toasts]);

  const toast = React.useMemo(() => {
    // Base toast function
    const baseToastFn = (opts: ToastOptions) => {
      const id = opts.id || genId();
      
      // Handle translation keys if provided
      let title = opts.title;
      let description = opts.description;
      
      if (opts.translateKeys) {
        if (opts.translateKeys.titleKey) {
          title = t(opts.translateKeys.titleKey);
        }
        
        if (opts.translateKeys.descriptionKey) {
          description = t(opts.translateKeys.descriptionKey);
        }
      }
      
      const update = state.toasts.find((t) => t.id === id);

      if (update) {
        dispatch({
          type: actionTypes.UPDATE_TOAST,
          toast: { ...opts, id, title, description },
        });
      } else {
        dispatch({
          type: actionTypes.ADD_TOAST,
          toast: {
            ...opts,
            id,
            title,
            description,
            open: true,
            onOpenChange: (open) => {
              if (!open) {
                dispatch({
                  type: actionTypes.DISMISS_TOAST,
                  toastId: id,
                });
              }
            },
          },
        });
      }

      return id;
    };
    
    // Create extended toast with category-specific methods
    const extendedToast = (props: ToastOptions) => baseToastFn(props);
    
    // Add category-specific toast shortcuts
    extendedToast.error = ({ title, ...props }: ToastOptions) => 
      baseToastFn({ 
        title: title || "Error", 
        variant: "destructive", 
        ...props 
      });
    
    // Add toast methods for specific events
    extendedToast.event = {
      updated: () => baseToastFn({ 
        description: t("events.eventUpdated"), 
        variant: "default"
      }),
      created: () => baseToastFn({ 
        description: t("events.eventCreated"), 
        variant: "default" 
      }),
      deleted: () => baseToastFn({ 
        description: t("events.eventDeleted"), 
        variant: "default" 
      }),
      bookingSubmitted: () => baseToastFn({
        description: t("bookings.requestSubmitted"),
        variant: "default"
      }),
      shareSuccess: () => baseToastFn({
        description: t("business.copiedToClipboard"),
        duration: 2000,
        variant: "default"
      }),
      newBookingRequest: () => baseToastFn({
        description: t("bookings.newRequest"),
        variant: "default"
      })
    };
    
    extendedToast.task = {
      updated: () => baseToastFn({ 
        description: t("tasks.taskUpdated"), 
        variant: "default" 
      }),
      created: () => baseToastFn({ 
        description: t("tasks.taskAdded"), 
        variant: "default" 
      }),
      deleted: () => baseToastFn({ 
        description: t("tasks.taskDeleted"), 
        variant: "default" 
      }),
    };
    
    extendedToast.note = {
      updated: () => baseToastFn({ 
        description: t("notes.noteUpdated"), 
        variant: "default" 
      }),
      created: () => baseToastFn({ 
        description: t("notes.noteAdded"), 
        variant: "default" 
      }),
      deleted: () => baseToastFn({ 
        description: t("notes.noteDeleted"), 
        variant: "default" 
      }),
      added: () => baseToastFn({ 
        description: t("notes.noteAdded"), 
        variant: "default" 
      }),
    };
    
    extendedToast.reminder = {
      created: () => baseToastFn({ 
        description: t("reminders.reminderCreated"), 
        variant: "default" 
      }),
    };
    
    extendedToast.booking = {
      approved: () => baseToastFn({
        description: t("bookings.requestApproved"),
        variant: "default"
      }),
      rejected: () => baseToastFn({
        description: t("bookings.requestRejected"),
        variant: "default"
      }),
      deleted: () => baseToastFn({
        description: t("bookings.requestDeleted"),
        variant: "default"
      }),
      newRequest: () => baseToastFn({
        description: t("bookings.newRequest"),
        variant: "default"
      })
    };

    return extendedToast;
  }, [state.toasts, t]);
  
  return {
    toast,
    dismiss: React.useCallback(
      (toastId?: string) => {
        dispatch({
          type: actionTypes.DISMISS_TOAST,
          toastId,
        });
      },
      []
    ),
    toasts: state.toasts,
  };
}

// Export the named hook
export { useToast as useToastWithTranslation };
