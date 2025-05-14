
import * as React from "react";
import { type ToastActionElement, ToastProps } from "@/components/ui/toast";

const TOAST_LIMIT = 20;
const TOAST_REMOVE_DELAY = 1000000;

export type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToasterToastActionElement;
  open: boolean;
  translateKeys?: {
    title?: string;
    description?: string;
  };
  translateParams?: Record<string, string | number>;
};

export type Toast = Omit<ToasterToast, "id" | "open">;

export type ToasterToastActionElement = React.ReactElement<typeof ToastActionElement>;

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const;

let count = 0;

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

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

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return;
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId);
    dispatch({
      type: "REMOVE_TOAST",
      toastId,
    });
  }, TOAST_REMOVE_DELAY);

  toastTimeouts.set(toastId, timeout);
};

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [...state.toasts, action.toast],
      };

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      };

    case "DISMISS_TOAST": {
      const { toastId } = action;

      // ! Side effects ! - This could be extracted into a dismissToast() action,
      // but I'll keep it here for simplicity
      if (toastId) {
        addToRemoveQueue(toastId);
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id);
        });
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t
        ),
      };
    }
    case "REMOVE_TOAST":
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
  }
};

const listeners: Array<(state: State) => void> = [];

let memoryState: State = { toasts: [] };

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => {
    listener(memoryState);
  });
}

function toast(props: Toast) {
  const id = genId();

  const update = (props: ToasterToast) =>
    dispatch({
      type: "UPDATE_TOAST",
      toast: { ...props, id },
    });

  const dismiss = () =>
    dispatch({ type: "DISMISS_TOAST", toastId: id });

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) {
          dismiss();
        }
      },
    },
  });

  return {
    id,
    dismiss,
    update,
  };
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, [state]);

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  };
}

// Enhanced toast event methods
toast.event = {
  created: () => toast({
    title: "Event Created",
    description: "Your event has been successfully created.",
  }),

  updated: () => toast({
    title: "Event Updated",
    description: "Your event has been successfully updated.",
  }),

  deleted: () => toast({
    title: "Event Deleted",
    description: "Your event has been successfully deleted.",
  }),

  bookingSubmitted: () => toast({
    title: "Booking Submitted",
    description: "Your booking request has been submitted.",
  }),

  newBookingRequest: () => toast({
    title: "New Booking Request",
    description: "You have received a new booking request.",
  })
};

// Standard notifications
toast.notification = (options: Toast) => toast({
  ...options,
  variant: options.variant || "default",
});

// For error notifications
toast.error = (options: Toast) => toast({
  ...options,
  variant: "destructive",
});

// For task notifications
toast.task = {
  created: () => toast({
    title: "Task Created",
    description: "Your task has been successfully created.",
  }),
  updated: () => toast({
    title: "Task Updated",
    description: "Your task has been successfully updated.",
  }),
  deleted: () => toast({
    title: "Task Deleted",
    description: "Your task has been successfully deleted.",
  }),
  completed: () => toast({
    title: "Task Completed",
    description: "Your task has been marked as completed.",
  }),
};

// For reminder notifications
toast.reminder = {
  created: () => toast({
    title: "Reminder Created",
    description: "Your reminder has been successfully created.",
  }),
  updated: () => toast({
    title: "Reminder Updated",
    description: "Your reminder has been successfully updated.",
  }),
  deleted: () => toast({
    title: "Reminder Deleted",
    description: "Your reminder has been successfully deleted.",
  }),
  triggered: (title: string) => toast({
    title: "Reminder",
    description: title || "It's time for your reminder!",
  }),
};

// For note notifications
toast.note = {
  created: () => toast({
    title: "Note Created",
    description: "Your note has been successfully created.",
  }),
  updated: () => toast({
    title: "Note Updated",
    description: "Your note has been successfully updated.",
  }),
  deleted: () => toast({
    title: "Note Deleted",
    description: "Your note has been successfully deleted.",
  }),
};

export { useToast, toast };
