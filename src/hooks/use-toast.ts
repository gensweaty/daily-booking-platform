import { useEffect, useState } from "react";

// Define the toast types without circular references
interface ToastProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactElement;
  variant?: "default" | "destructive";
  duration?: number;
  translateKeys?: {
    titleKey?: string;
    descriptionKey?: string;
  };
  translateParams?: Record<string, string | number>;
}

export interface ToasterToast extends ToastProps {
  id: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export type Toast = Omit<ToasterToast, "id" | "open" | "onOpenChange">;

const TOAST_LIMIT = 5;
const TOAST_REMOVE_DELAY = 1000000;

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

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return;
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId);
    dispatch({
      type: actionTypes.REMOVE_TOAST,
      toastId: toastId,
    });
  }, TOAST_REMOVE_DELAY);

  toastTimeouts.set(toastId, timeout);
};

export const reducer = (state: ToasterToast[], action: any): ToasterToast[] => {
  switch (action.type) {
    case actionTypes.ADD_TOAST:
      return [
        ...state,
        { ...action.toast, id: action.toast.id || genId(), open: true },
      ];

    case actionTypes.UPDATE_TOAST:
      return state.map((t) =>
        t.id === action.toastId ? { ...t, ...action.toast } : t
      );

    case actionTypes.DISMISS_TOAST: {
      const { toastId } = action;

      // ! Side effects ! - This could be extracted into a dismissToast() action,
      // but I'll keep it here for simplicity
      if (toastId) {
        addToRemoveQueue(toastId);
      } else {
        state.forEach((toast) => {
          addToRemoveQueue(toast.id);
        });
      }

      return state.map((t) =>
        t.id === toastId || toastId === undefined
          ? {
              ...t,
              open: false,
            }
          : t
      );
    }
    case actionTypes.REMOVE_TOAST:
      if (action.toastId === undefined) {
        return [];
      }
      return state.filter((t) => t.id !== action.toastId);
    default:
      return state;
  }
};

const listeners: Array<(state: ToasterToast[]) => void> = [];

let memoryState: ToasterToast[] = [];

function dispatch(action: any) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => {
    listener(memoryState);
  });
}

// Helper function to create a toast
function createToast(props: Toast) {
  const id = genId();

  const update = (props: ToasterToast) =>
    dispatch({
      type: actionTypes.UPDATE_TOAST,
      toast: { ...props },
      toastId: id,
    });

  const dismiss = () =>
    dispatch({ type: actionTypes.DISMISS_TOAST, toastId: id });

  dispatch({
    type: actionTypes.ADD_TOAST,
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open: boolean) => {
        if (!open) dismiss();
      },
    },
  });

  return {
    id: id,
    dismiss,
    update,
  };
}

// Main toast function
function toast(props: Toast) {
  return createToast(props);
}

// Add error toast method
toast.error = (props: Toast) => {
  return createToast({
    variant: "destructive",
    ...props,
  });
};

// Event toast objects for common UI interactions
toast.event = {
  created: () => {
    return createToast({
      translateKeys: {
        titleKey: "common.success",
        descriptionKey: "common.itemCreated"
      }
    });
  },
  updated: () => {
    return createToast({
      translateKeys: {
        titleKey: "common.success",
        descriptionKey: "common.itemUpdated"
      }
    });
  },
  deleted: () => {
    return createToast({
      translateKeys: {
        titleKey: "common.success",
        descriptionKey: "common.itemDeleted"
      }
    });
  },
  newBookingRequest: () => {
    return createToast({
      translateKeys: {
        titleKey: "bookings.newRequest",
        descriptionKey: "bookings.newRequestDescription"
      }
    });
  }
};

// Task related toast notifications
toast.task = {
  created: () => {
    return createToast({
      translateKeys: {
        titleKey: "common.success",
        descriptionKey: "tasks.taskCreated"
      }
    });
  },
  updated: () => {
    return createToast({
      translateKeys: {
        titleKey: "common.success",
        descriptionKey: "tasks.taskUpdated"
      }
    });
  }
};

// Note related toast notifications
toast.note = {
  created: () => {
    return createToast({
      translateKeys: {
        titleKey: "common.success",
        descriptionKey: "notes.noteCreated"
      }
    });
  },
  updated: () => {
    return createToast({
      translateKeys: {
        titleKey: "common.success",
        descriptionKey: "notes.noteUpdated"
      }
    });
  }
};

// Reminder related toast notifications
toast.reminder = {
  created: () => {
    return createToast({
      translateKeys: {
        titleKey: "common.success", 
        descriptionKey: "reminders.reminderCreated"
      }
    });
  },
  updated: () => {
    return createToast({
      translateKeys: {
        titleKey: "common.success",
        descriptionKey: "reminders.reminderUpdated"
      }
    });
  }
};

// Booking related toast notifications
toast.booking = {
  submitted: () => {
    return createToast({
      translateKeys: {
        titleKey: "common.success",
        descriptionKey: "bookings.bookingSubmitted"
      }
    });
  }
};

function useToast() {
  const [state, setState] = useState<ToasterToast[]>(memoryState);

  useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, [state]);

  return {
    toasts: state,
    toast,
    dismiss: (toastId?: string) =>
      dispatch({ type: actionTypes.DISMISS_TOAST, toastId }),
  };
}

export { useToast, toast };
