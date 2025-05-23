import * as React from "react"
import type { ToastActionElement, ToastProps } from "@/components/ui/toast"
import { useLanguage } from "@/contexts/LanguageContext"

const TOAST_LIMIT = 1
const TOAST_REMOVE_DELAY = 5000

type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
  translateKeys?: {
    titleKey?: string
    descriptionKey?: string
  }
  translateParams?: Record<string, string | number>
}

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const

let count = 0

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
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

function getTranslationFunction() {
  // Default fallback function returns the key itself, with parameter handling
  let translationFunction = (key: string, params?: Record<string, string | number>): string => {
    if (!params) return key;
    
    // Simple parameter replacement for fallback
    return Object.entries(params).reduce((str, [param, value]) => {
      return str.replace(new RegExp(`{{${param}}}`, 'g'), String(value));
    }, key);
  };
  
  try {
    // Get the translation function from the language context
    const { t } = useLanguage();
    translationFunction = t;
  } catch (error) {
    console.warn("Language context not available, using fallback for translations");
  }
  
  return translationFunction;
}

function toast({ ...props }: Toast) {
  // Get the translation function
  const t = getTranslationFunction();
  
  const id = genId()

  // Apply translations if translation keys are provided
  let translatedProps = { ...props };
  if (props.translateKeys) {
    if (props.translateKeys.titleKey && typeof props.translateKeys.titleKey === 'string') {
      translatedProps.title = t(props.translateKeys.titleKey);
    }
    if (props.translateKeys.descriptionKey && typeof props.translateKeys.descriptionKey === 'string') {
      if (props.translateParams) {
        // Handle parameters for description
        translatedProps.description = t(props.translateKeys.descriptionKey, props.translateParams);
      } else {
        translatedProps.description = t(props.translateKeys.descriptionKey);
      }
    }
  }

  const update = (props: ToasterToast) =>
    dispatch({
      type: "UPDATE_TOAST",
      toast: { ...props, id },
    })
    
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id })

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...translatedProps,
      id,
      open: true,
      translateParams: props.translateParams, // Pass translateParams to the toast
      onOpenChange: (open) => {
        if (!open) dismiss()
      },
    },
  })

  setTimeout(dismiss, TOAST_REMOVE_DELAY)

  return {
    id: id,
    dismiss,
    update,
  }
}

toast.success = (props: { title?: string; description?: string } & Omit<Toast, "title" | "description">) => {
  return toast({
    ...props,
    variant: "default",
    translateKeys: {
      titleKey: props.title ? undefined : "common.success",
      descriptionKey: props.description ? undefined : "common.successMessage"
    }
  });
};

toast.error = (props: { title?: string; description?: string } & Omit<Toast, "title" | "description">) => {
  return toast({
    ...props,
    variant: "destructive",
    translateKeys: {
      titleKey: props.title ? undefined : "common.error",
      descriptionKey: props.description ? undefined : "common.errorOccurred"
    }
  });
};

toast.event = {
  created: () => {
    return toast({
      variant: "default",
      translateKeys: {
        titleKey: "common.success",
        descriptionKey: "events.eventCreated"
      }
    });
  },
  updated: () => {
    return toast({
      variant: "default",
      translateKeys: {
        titleKey: "common.success",
        descriptionKey: "events.eventUpdated"
      }
    });
  },
  deleted: () => {
    return toast({
      variant: "default",
      translateKeys: {
        titleKey: "common.success",
        descriptionKey: "events.eventDeleted"
      }
    });
  },
  bookingApproved: () => {
    return toast({
      variant: "default",
      translateKeys: {
        titleKey: "common.success",
        descriptionKey: "bookings.requestApproved"
      }
    });
  },
  bookingRejected: () => {
    return toast({
      variant: "default",
      translateKeys: {
        titleKey: "common.success", 
        descriptionKey: "bookings.requestRejected"
      }
    });
  },
  bookingDeleted: () => {
    return toast({
      variant: "default",
      translateKeys: {
        titleKey: "common.success",
        descriptionKey: "bookings.requestDeleted"
      }
    });
  },
  newBookingRequest: (count: number = 1) => {
    return toast({
      variant: "default",
      translateKeys: {
        titleKey: "bookings.newRequest",
        descriptionKey: "bookings.pendingRequestsCount"
      },
      translateParams: {
        count: count
      }
    });
  },
  bookingSubmitted: () => {
    return toast({
      variant: "default",
      translateKeys: {
        titleKey: "bookings.requestSubmitted",
        descriptionKey: "bookings.requestSubmittedDescription"
      }
    });
  }
};

toast.task = {
  created: () => {
    return toast({
      variant: "default",
      translateKeys: {
        titleKey: "common.success",
        descriptionKey: "tasks.taskAdded" 
      }
    });
  },
  updated: () => {
    return toast({
      variant: "default",
      translateKeys: {
        titleKey: "common.success",
        descriptionKey: "tasks.taskUpdated"
      }
    });
  },
  deleted: () => {
    return toast({
      variant: "default",
      translateKeys: {
        titleKey: "common.success",
        descriptionKey: "tasks.taskDeleted"
      }
    });
  }
};

toast.customer = {
  created: () => {
    return toast({
      variant: "default",
      translateKeys: {
        titleKey: "common.success",
        descriptionKey: "crm.customerCreated"
      }
    });
  },
  updated: () => {
    return toast({
      variant: "default",
      translateKeys: {
        titleKey: "common.success",
        descriptionKey: "crm.customerUpdated"
      }
    });
  },
  deleted: () => {
    return toast({
      variant: "default",
      translateKeys: {
        titleKey: "common.success",
        descriptionKey: "crm.customerDeleted"
      }
    });
  }
};

toast.note = {
  added: () => {
    return toast({
      variant: "default",
      translateKeys: {
        titleKey: "notes.noteAdded",
        descriptionKey: "notes.noteAddedDescription"
      }
    });
  },
  updated: () => {
    return toast({
      variant: "default",
      translateKeys: {
        titleKey: "common.success",
        descriptionKey: "notes.noteUpdated"
      }
    });
  },
  deleted: () => {
    return toast({
      variant: "default",
      translateKeys: {
        titleKey: "common.success",
        descriptionKey: "notes.noteDeleted"
      }
    });
  }
};

toast.reminder = {
  created: () => {
    return toast({
      variant: "default",
      translateKeys: {
        titleKey: "common.success",
        descriptionKey: "reminders.reminderCreated"
      }
    });
  }
};

toast.exportSuccess = () => {
  return toast({
    variant: "default",
    translateKeys: {
      titleKey: "dashboard.exportSuccessful",
      descriptionKey: "dashboard.exportSuccessMessage"
    }
  });
};

toast.copySuccess = () => {
  return toast({
    variant: "default",
    translateKeys: {
      titleKey: "common.success",
      descriptionKey: "common.copiedToClipboard"
    }
  });
};

toast.deleteSuccess = () => {
  return toast({
    variant: "default",
    translateKeys: {
      titleKey: "common.success",
      descriptionKey: "common.deleteSuccess"
    }
  });
};

toast.saveSuccess = () => {
  return toast({
    variant: "default",
    translateKeys: {
      titleKey: "common.success",
      descriptionKey: "common.successMessage"
    }
  });
};

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

export { useToast, toast }
