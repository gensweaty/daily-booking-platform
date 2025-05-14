
import { Toast, ToastActionElement } from "@/components/ui/toast";

export type ToasterToast = Toast & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

const TOAST_LIMIT = 5;
const TOAST_REMOVE_DELAY = 1000000;

type ToasterToastState = {
  toasts: ToasterToast[];
};

import { create } from "zustand";

export const useToastStore = create<ToasterToastState>((set) => ({
  toasts: [],
}));

let count = 0;

function generateId() {
  count = (count + 1) % Number.MAX_VALUE;
  return count.toString();
}

type ToastProps = Omit<ToasterToast, "id">;

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const;

let listeners: Array<(state: ToasterToastState) => void> = [];

let memoryState: ToasterToastState = { toasts: [] };

function dispatch(action: any) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => {
    listener(memoryState);
  });
}

interface Action {
  type: keyof typeof actionTypes;
}

interface AddToastAction extends Action {
  type: "ADD_TOAST";
  toast: ToastProps;
}

interface UpdateToastAction extends Action {
  type: "UPDATE_TOAST";
  toast: Partial<ToasterToast>;
  id: string;
}

interface DismissToastAction extends Action {
  type: "DISMISS_TOAST";
  toastId?: string;
}

interface RemoveToastAction extends Action {
  type: "REMOVE_TOAST";
  toastId?: string;
}

type ToastAction =
  | AddToastAction
  | UpdateToastAction
  | DismissToastAction
  | RemoveToastAction;

function reducer(state: ToasterToastState, action: ToastAction): ToasterToastState {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [
          ...state.toasts.filter((t) => t.id !== action.toast.id),
          {
            ...action.toast,
            id: action.toast.id || generateId(),
            open: true,
            onOpenChange: (open: boolean) => {
              if (!open) {
                dispatch({
                  type: "DISMISS_TOAST",
                  toastId: action.toast.id,
                });
              }
            },
          },
        ].slice(-TOAST_LIMIT),
      };
    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.id ? { ...t, ...action.toast } : t
        ),
      };
    case "DISMISS_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toastId || action.toastId === undefined
            ? { ...t, open: false }
            : t
        ),
      };
    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        return { ...state, toasts: [] };
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      };
    default:
      return state;
  }
}

export function useToast() {
  const { toasts } = useToastStore();

  return {
    toasts,
    toast: (props: ToastProps) => {
      const id = props.id || generateId();
      
      const update = (props: ToastProps) => {
        dispatch({ type: "UPDATE_TOAST", id, toast: { ...props, id } });
      };

      const dismiss = () => {
        dispatch({ type: "DISMISS_TOAST", toastId: id });
      };

      dispatch({
        type: "ADD_TOAST",
        toast: { ...props, id, onOpenChange: (open: boolean) => {
          if (!open) dismiss();
        } },
      });

      return {
        id,
        dismiss,
        update,
      };
    },
    dismiss: (toastId?: string) => {
      dispatch({ type: "DISMISS_TOAST", toastId });
    },
    update: (id: string, props: ToastProps) => {
      dispatch({ type: "UPDATE_TOAST", id, toast: props });
    },
  };
}

// For direct usage outside of React components
export const toast = {
  create: (props: ToastProps) => {
    const id = props.id || generateId();
    
    dispatch({
      type: "ADD_TOAST",
      toast: {
        ...props,
        id,
        onOpenChange: (open: boolean) => {
          if (!open) {
            dispatch({ type: "DISMISS_TOAST", toastId: id });
          }
        },
      },
    });

    return {
      id,
      dismiss: () => dispatch({ type: "DISMISS_TOAST", toastId: id }),
      update: (props: ToastProps) => 
        dispatch({ type: "UPDATE_TOAST", id, toast: { ...props, id } }),
    };
  },
  dismiss: (toastId?: string) => {
    dispatch({ type: "DISMISS_TOAST", toastId });
  },
  update: (id: string, props: ToastProps) => {
    dispatch({ type: "UPDATE_TOAST", id, toast: props });
  },
};

// Re-export the toast interface for use-toast.ts
export { toast as toast };
