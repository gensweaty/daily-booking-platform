import * as React from "react"
import type { ToastActionElement, ToastProps } from "@/components/ui/toast"

const TOAST_LIMIT = 10
const TOAST_REMOVE_DELAY = 1000000

type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const

let count = 0

function genId() {
  count = (count + 1) % Number.MAX_VALUE
  return count.toString()
}

type ActionType = typeof actionTypes

type Action =
  | {
      type: ActionType["ADD_TOAST"]
      toast: ToasterToast
    }
  | {
      type: ActionType["UPDATE_TOAST"]
      toast: Partial<ToasterToast> & { id: string }
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

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

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
        addToRemoveQueue(toastId)
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id)
        })
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

const listeners: Array<(state: State) => void> = []

let memoryState: State = { toasts: [] }

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => {
    listener(memoryState)
  })
}

type Toast = Omit<ToasterToast, "id">

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
    id: id,
    dismiss,
    update,
  }
}

// Helper for a standardized success toast
toast.success = (options: { title?: string; description: string }) => {
  return toast({
    title: options.title || "Success",
    description: options.description,
    variant: "default",
  })
}

// Helper for a standardized error toast
toast.error = (options: { title?: string; description: string }) => {
  return toast({
    title: options.title || "Error",
    description: options.description,
    variant: "destructive",
  })
}

// Define the task-related toast notifications
toast.task = {
  created: () => {
    return toast({
      title: "Task Created",
      description: "Your task has been created successfully.",
    })
  },
  updated: () => {
    return toast({
      title: "Task Updated",
      description: "Your task has been updated successfully.",
    })
  },
  deleted: () => {
    return toast({
      title: "Task Deleted",
      description: "Your task has been deleted.",
    })
  }
}

// Define the note-related toast notifications
toast.note = {
  added: () => {
    return toast({
      title: "Note Added",
      description: "Your note has been added successfully.",
    })
  },
  updated: () => {
    return toast({
      title: "Note Updated",
      description: "Your note has been updated successfully.",
    })
  },
  deleted: () => {
    return toast({
      title: "Note Deleted",
      description: "Your note has been deleted.",
    })
  }
}

// Define the reminder-related toast notifications
toast.reminder = {
  created: () => {
    return toast({
      title: "Reminder Created",
      description: "Your reminder has been created successfully.",
    })
  },
  updated: () => {
    return toast({
      title: "Reminder Updated",
      description: "Your reminder has been updated successfully.",
    })
  },
  deleted: () => {
    return toast({
      title: "Reminder Deleted",
      description: "Your reminder has been deleted.",
    })
  }
}

// Define the event sub-object for specialized toast notifications
toast.event = {
  bookingSubmitted: (title?: string) => {
    return toast({
      title: title || "Booking Submitted",
      description: "Thank you! Your booking request has been received.",
    })
  },
  newBookingRequest: () => {
    return toast({
      title: "New Booking Request",
      description: "You have received a new booking request.",
    })
  }
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [state])

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  }
}

function addToRemoveQueue(toastId: string) {
  if (toastTimeouts.has(toastId)) {
    return
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({
      type: "REMOVE_TOAST",
      toastId,
    })
  }, TOAST_REMOVE_DELAY)

  toastTimeouts.set(toastId, timeout)
}

export { useToast, toast }
