import { Toast, ToastActionElement, ToastProps } from "@/components/ui/toast"

type ToastOptions = {
  title?: string;
  description?: string;
  action?: ToastActionElement;
  variant?: "default" | "destructive";
  translateParams?: Record<string, string | number>;
};

const TOAST_LIMIT = 20;
const TOAST_REMOVE_DELAY = 1000000;

type ToasterToast = ToastOptions & {
  id: string;
  duration?: number;
  onOpenChange?: (open: boolean) => void;
}

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const

let count = 0;

function genId() {
  count = (count + 1) % Number.MAX_VALUE;
  return count.toString();
}

type ActionType = typeof actionTypes

type Action =
  | {
      type: ActionType["ADD_TOAST"]
      toast: ToasterToast
    }
  | {
      type: ActionType["UPDATE_TOAST"]
      toast: Partial<ToasterToast>
    }
  | {
      type: ActionType["DISMISS_TOAST"]
      toastId?: string
    }
  | {
      type: ActionType["REMOVE_TOAST"]
      toastId?: string
    }

interface State {
  toasts: ToasterToast[]
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      }

    case "DISMISS_TOAST": {
      const { toastId } = action

      // ! Side effects ! - This could be extracted into a dismissToast() action,
      // but I'll keep it here for simplicity
      if (toastId) {
        if (toastTimeouts.has(toastId)) {
          clearTimeout(toastTimeouts.get(toastId))
          toastTimeouts.delete(toastId)
        }
      } else {
        for (const [id, timeout] of toastTimeouts.entries()) {
          clearTimeout(timeout)
          toastTimeouts.delete(id)
        }
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
      }
    }
    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        }
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      }
  }
}

let listeners: Array<(state: State) => void> = []

let memoryState: State = { toasts: [] }

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => {
    listener(memoryState)
  })
}

interface Toast extends Omit<ToasterToast, "id"> {}

function toast({ ...props }: Toast) {
  const id = genId()

  const update = (props: ToasterToast) =>
    dispatch({
      type: "UPDATE_TOAST",
      toast: { ...props, id },
    })

  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id })

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss()
      },
    },
  })

  return {
    id,
    dismiss,
    update,
  }
}

// Create more toast variants
toast.notification = (options: ToastOptions) => {
  return toast({ ...options });
};

toast.error = (options: ToastOptions) => {
  return toast({ ...options, variant: "destructive" });
};

toast.task = {
  created: () => toast({ 
    title: "Task created", 
    description: "Your task has been created successfully" 
  }),
  updated: () => toast({ 
    title: "Task updated", 
    description: "Your task has been updated successfully" 
  }),
};

toast.reminder = {
  created: () => toast({ 
    title: "Reminder created", 
    description: "Your reminder has been created successfully" 
  }),
};

toast.note = {
  added: () => toast({ 
    title: "Note added", 
    description: "Your note has been added successfully" 
  }),
};

toast.event = {
  created: () => toast({
    title: "Event created",
    description: "Your event has been created successfully"
  }),
  updated: () => toast({
    title: "Event updated",
    description: "Your event has been updated successfully"
  }),
  deleted: () => toast({
    title: "Event deleted",
    description: "Your event has been deleted successfully"
  })
};

function useToast() {
  const subscribe = (listener: (state: State) => void) => {
    listeners.push(listener)
    return () => {
      listeners = listeners.filter((l) => l !== listener)
    }
  }

  const getToasts = () => memoryState.toasts

  return {
    toast,
    subscribe,
    getToasts,
    toasts: memoryState.toasts,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  }
}

export { useToast, toast, type ToastOptions };
