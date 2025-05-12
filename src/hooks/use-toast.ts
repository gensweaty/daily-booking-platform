
import * as React from "react"
import {
  type ToastActionElement,
  ToastProps,
} from "@/components/ui/toast"

const TOAST_LIMIT = 5
const TOAST_REMOVE_DELAY = 1000000

type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  translateParams?: Record<string, string | number>
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
      toast: Partial<ToasterToast>
    }
  | {
      type: ActionType["DISMISS_TOAST"]
      toastId?: ToasterToast["id"]
    }
  | {
      type: ActionType["REMOVE_TOAST"]
      toastId?: ToasterToast["id"]
    }

interface State {
  toasts: ToasterToast[]
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({
      type: "REMOVE_TOAST",
      toastId: toastId,
    })
  }, TOAST_REMOVE_DELAY)

  toastTimeouts.set(toastId, timeout)
}

export const reducer = (state: State, action: Action): State => {
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

interface ToastOptions extends Toast {
  translateParams?: Record<string, string | number>
}

function createToast(props: ToastOptions) {
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

function toast(props: ToastOptions) {
  return createToast(props)
}

// Add custom toast types
toast.error = (props: Omit<ToastOptions, "variant"> | { description: string }) => {
  if ('description' in props && Object.keys(props).length === 1) {
    return createToast({ ...props, variant: "destructive" })
  }
  return createToast({ ...props as ToastOptions, variant: "destructive" })
}

toast.success = (props: Omit<ToastOptions, "variant"> | { description: string }) => {
  if ('description' in props && Object.keys(props).length === 1) {
    return createToast({ ...props, variant: "default" })
  }
  return createToast({ ...props as ToastOptions, variant: "default" })
}

// Custom domain-specific toasts
toast.note = {
  added: () => createToast({
    title: "Note Added",
    description: "Your note has been saved successfully",
  }),
  updated: () => createToast({
    title: "Note Updated",
    description: "Your note has been updated successfully",
  }),
  deleted: () => createToast({
    title: "Note Deleted",
    description: "Your note has been deleted successfully",
  }),
}

toast.task = {
  created: () => createToast({
    title: "Task Added",
    description: "Task added successfully",
  }),
  updated: () => createToast({
    title: "Task Updated",
    description: "Task updated successfully",
  }),
  deleted: () => createToast({
    title: "Task Deleted",
    description: "Task deleted successfully",
  }),
}

toast.reminder = {
  created: () => createToast({
    title: "Reminder Created",
    description: "Reminder created successfully",
  }),
}

toast.event = {
  created: () => createToast({
    title: "Event Created",
    description: "Event created successfully",
  }),
  updated: () => createToast({
    title: "Event Updated",
    description: "Event updated successfully",
  }),
  deleted: () => createToast({
    title: "Event Deleted",
    description: "Event deleted successfully",
  }),
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

export { useToast, toast, type ToastOptions }
