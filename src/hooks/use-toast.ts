import { useEffect, useState } from "react";

type ToastEvent = {
  created: () => {
    id: string;
    dismiss: () => void;
    update: (props: ToasterToast) => void;
  };
  updated: () => {
    id: string;
    dismiss: () => void;
    update: (props: ToasterToast) => void;
  };
  deleted: () => {
    id: string;
    dismiss: () => void;
    update: (props: ToasterToast) => void;
  };
  newBookingRequest: () => {
    id: string;
    dismiss: () => void;
    update: (props: ToasterToast) => void;
  };
};

const TOAST_LIMIT = 5;
const TOAST_REMOVE_DELAY = 1000000;

type ToasterToast = Omit<Toast, "id"> & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToasterToastActionElement;
  open: boolean;
  translateKeys?: {
    titleKey?: string;
    descriptionKey?: string;
  };
  translateParams?: Record<string, string | number>;
};

export type Toast = Omit<ToasterToast, "id" | "open">;

export type ToasterToastActionElement = React.ReactElement<any>;

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

type Toast = Omit<ToasterToast, "id" | "open">;

function toast({ ...props }: Toast) {
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

// Event toast objects for common UI interactions
toast.event = {
  created: () => {
    return toast({
      translateKeys: {
        titleKey: "common.success",
        descriptionKey: "common.itemCreated"
      }
    });
  },
  updated: () => {
    return toast({
      translateKeys: {
        titleKey: "common.success",
        descriptionKey: "common.itemUpdated"
      }
    });
  },
  deleted: () => {
    return toast({
      translateKeys: {
        titleKey: "common.success",
        descriptionKey: "common.itemDeleted"
      }
    });
  },
  newBookingRequest: () => {
    return toast({
      translateKeys: {
        titleKey: "bookings.newRequest",
        descriptionKey: "bookings.newRequestDescription"
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
