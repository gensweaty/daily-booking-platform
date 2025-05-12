import { Toast as ToastPrimitive, ToastActionElement, ToastProps } from "@/components/ui/toast";
import * as React from "react";
import { LanguageText } from "@/components/shared/LanguageText";
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
};

type ToastOptions = Partial<
  Pick<ToasterToast, "id" | "title" | "description" | "action" | "variant">
> & {
  translateParams?: Record<string, string | number>;
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

// Toast hook
const useToast = () => {
  const [state, dispatch] = React.useReducer(toastReducer, {
    toasts: [],
  });

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

  const toast = React.useCallback(
    function toast(opts: ToastOptions) {
      const id = opts.id || genId();
      const update = state.toasts.find((t) => t.id === id);

      if (update) {
        dispatch({
          type: actionTypes.UPDATE_TOAST,
          toast: { ...opts, id },
        });
      } else {
        dispatch({
          type: actionTypes.ADD_TOAST,
          toast: {
            ...opts,
            id,
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
    },
    [state.toasts]
  );

  const dismiss = React.useCallback(
    (toastId?: string) => {
      dispatch({
        type: actionTypes.DISMISS_TOAST,
        toastId,
      });
    },
    []
  );

  return {
    toast,
    dismiss,
    toasts: state.toasts,
  };
};

// Create extension with specific types and functionality
const createExtendedToast = (baseToast: ReturnType<typeof useToast>["toast"]) => {
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

// Main implementation
const useToastWithTranslation = () => {
  const baseHook = useToast();
  const { t } = useLanguage();
  
  // Create toast methods with translation support
  const wrappedToast = (props: ToastOptions) => {
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
    
    return baseHook.toast({ ...props, title, description });
  };
  
  const toast = createExtendedToast(wrappedToast);
  
  return { 
    toast, 
    dismiss: baseHook.dismiss, 
    toasts: baseHook.toasts 
  };
};

// Export both the hook and the toast function
export { useToastWithTranslation as useToast, createExtendedToast as toast };
