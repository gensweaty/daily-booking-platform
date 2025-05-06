import { toast as sonnerToast, ToastT, ExternalToast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

export const useToast = () => {
  const { t, language } = useLanguage();
  
  return {
    toast: {
      success: ({ title = t("common.success"), description, ...props }: ExternalToast) => {
        sonnerToast.success(title, {
          description,
          ...props
        });
      },
      info: ({ title = t("common.info"), description, ...props }: ExternalToast) => {
        sonnerToast.info(title, {
          description,
          ...props
        });
      },
      warning: ({ title = t("common.warning"), description, ...props }: ExternalToast) => {
        sonnerToast.warning(title, {
          description,
          ...props
        });
      },
      error: ({ title = t("common.error"), description, ...props }: ExternalToast) => {
        sonnerToast.error(title, {
          description,
          ...props
        });
      },
      custom: (props: ToastT) => sonnerToast(props),
      // Add sub-objects for specific entity toasts
      note: {
        added: () => {
          const { t } = useLanguage();
          sonnerToast.success(t("common.success"), {
            description: t("notes.noteCreated")
          });
        },
        updated: () => {
          const { t } = useLanguage();
          sonnerToast.success(t("common.success"), {
            description: t("notes.noteUpdated")
          });
        },
        deleted: () => {
          const { t } = useLanguage();
          sonnerToast.success(t("common.success"), {
            description: t("notes.noteDeleted")
          });
        }
      },
      reminder: {
        created: () => {
          const { t } = useLanguage();
          sonnerToast.success(t("common.success"), {
            description: t("reminders.created")
          });
        },
        updated: () => {
          const { t } = useLanguage();
          sonnerToast.success(t("common.success"), {
            description: t("reminders.updated")
          });
        },
        deleted: () => {
          const { t } = useLanguage();
          sonnerToast.success(t("common.success"), {
            description: t("reminders.deleted")
          });
        }
      },
      task: {
        created: () => {
          const { t } = useLanguage();
          sonnerToast.success(t("common.success"), {
            description: t("tasks.taskCreated")
          });
        },
        updated: () => {
          const { t } = useLanguage();
          sonnerToast.success(t("common.success"), {
            description: t("tasks.taskUpdated")
          });
        },
        deleted: () => {
          const { t } = useLanguage();
          sonnerToast.success(t("common.success"), {
            description: t("tasks.taskDeleted")
          });
        },
        statusChanged: () => {
          const { t } = useLanguage();
          sonnerToast.success(t("common.success"), {
            description: t("tasks.taskStatusChanged")
          });
        }
      },
      event: {
        // Booking notifications
        bookingSubmitted: () => {
          const { language } = useLanguage();
          const message = language === 'ka' ? 
            "თქვენი ჯავშანი წარმატებით გაიგზავნა" : 
            "Your booking request has been submitted";
            
          sonnerToast.success(language === 'ka' ? "ჯავშანი გაგზავნილია" : "Booking Submitted", {
            description: message
          });
        },
        bookingApproved: () => {
          const { language } = useLanguage();
          const message = language === 'ka' ? 
            "ჯავშანი დადასტურებულია" : 
            "Booking request has been approved";
            
          sonnerToast.success(language === 'ka' ? "ჯავშანი დადასტურებულია" : "Booking Approved", {
            description: message
          });
        },
        bookingRejected: () => {
          const { language } = useLanguage();
          const message = language === 'ka' ? 
            "ჯავშანი უარყოფილია" : 
            "Booking request has been rejected";
            
          sonnerToast.info(language === 'ka' ? "ჯავშანი უარყოფილია" : "Booking Rejected", {
            description: message
          });
        },
        bookingDeleted: () => {
          const { language } = useLanguage();
          const message = language === 'ka' ? 
            "ჯავშანი წაშლილია" : 
            "Booking has been deleted";
            
          sonnerToast.info(language === 'ka' ? "ჯავშანი წაშლილია" : "Booking Deleted", {
            description: message
          });
        },
        newBookingRequest: (count: number = 1) => {
          const { language } = useLanguage();
          const message = language === 'ka' ? 
            `თქვენ გაქვთ ${count} ახალი ჯავშნის მოთხოვნა` : 
            `You have ${count} new booking ${count === 1 ? 'request' : 'requests'}`;
            
          sonnerToast.info(
            language === 'ka' ? "ახალი ჯავშნის მოთხოვნა" : "New Booking Request", 
            { description: message }
          );
        },
        // Customer notifications
        customerCreated: () => {
          const { t } = useLanguage();
          sonnerToast.success(t("common.success"), {
            description: t("customers.customerCreated")
          });
        },
        customerUpdated: () => {
          const { t } = useLanguage();
          sonnerToast.success(t("common.success"), {
            description: t("customers.customerUpdated")
          });
        },
        customerDeleted: () => {
          const { t } = useLanguage();
          sonnerToast.success(t("common.success"), {
            description: t("customers.customerDeleted")
          });
        },
        // Event notifications
        eventCreated: () => {
          const { t } = useLanguage();
          sonnerToast.success(t("common.success"), {
            description: t("events.eventCreated")
          });
        },
        eventUpdated: () => {
          const { t } = useLanguage();
          sonnerToast.success(t("common.success"), {
            description: t("events.eventUpdated")
          });
        },
        eventDeleted: () => {
          const { t } = useLanguage();
          sonnerToast.success(t("common.success"), {
            description: t("events.eventDeleted")
          });
        }
      },
      // Generic action notifications
      saved: () => {
        const { t } = useLanguage();
        sonnerToast.success(t("common.success"), {
          description: t("common.saved")
        });
      },
      deleted: () => {
        const { t } = useLanguage();
        sonnerToast.success(t("common.success"), {
          description: t("common.deleted")
        });
      },
      updated: () => {
        const { t } = useLanguage();
        sonnerToast.success(t("common.success"), {
          description: t("common.updated")
        });
      },
      copied: () => {
        const { t } = useLanguage();
        sonnerToast.success(t("common.success"), {
          description: t("common.copied")
        });
      }
    }
  };
};

// Define a proper type for our callable toast function
type ToastFunctionProps = ToastT | { 
  title?: string; 
  description?: string; 
  variant?: "default" | "destructive"; 
  [key: string]: any 
};

// Create the base function type for toast with all the method signatures
interface ToastFunction {
  (props: ToastFunctionProps): ReturnType<typeof sonnerToast>;
  (title: string, props?: ToastFunctionProps): ReturnType<typeof sonnerToast>;
  success: (props: ToastFunctionProps | string) => void;
  info: (props: ToastFunctionProps | string) => void;
  warning: (props: ToastFunctionProps | string) => void;
  error: (props: ToastFunctionProps | string) => void;
  custom: (props: ToastT) => ReturnType<typeof sonnerToast>;
  translateKeys: (keys: { titleKey?: string; descriptionKey?: string }) => void;
  
  // Entity-specific toast methods
  event: {
    bookingSubmitted: () => void;
    bookingApproved: () => void;
    bookingRejected: () => void;
    bookingDeleted: () => void;
    newBookingRequest: (count?: number) => void;
    customerCreated: () => void;
    customerUpdated: () => void;
    customerDeleted: () => void;
    eventCreated: () => void;
    eventUpdated: () => void;
    eventDeleted: () => void;
  };
  task: {
    created: () => void;
    updated: () => void;
    deleted: () => void;
    statusChanged: () => void;
  };
  note: {
    added: () => void;
    updated: () => void;
    deleted: () => void;
  };
  reminder: {
    created: () => void;
    updated: () => void;
    deleted: () => void;
  };
  
  // Common actions
  saved: () => void;
  deleted: () => void;
  updated: () => void;
  copied: () => void;
}

// Create the actual callable toast function
const toastFn = function(
  titleOrProps: string | ToastFunctionProps, 
  props?: ToastFunctionProps
): ReturnType<typeof sonnerToast> {
  // Handle string title with optional props
  if (typeof titleOrProps === 'string') {
    return sonnerToast(titleOrProps, props);
  }
  
  // Handle object with title and description
  if (titleOrProps && typeof titleOrProps === 'object') {
    const { title, description, variant, ...rest } = titleOrProps;

    // Special case for translateKeys
    if ('translateKeys' in titleOrProps) {
      const { translateKeys } = titleOrProps as any;
      const { t } = useLanguage();
      return sonnerToast(
        translateKeys.titleKey ? t(translateKeys.titleKey) : t("common.success"),
        {
          description: translateKeys.descriptionKey ? t(translateKeys.descriptionKey) : undefined
        }
      );
    }
    
    // Handle variant property
    if (variant === "destructive") {
      return sonnerToast.error(title as string, { description, ...rest });
    } else {
      return sonnerToast(titleOrProps as ToastT);
    }
  }
  
  // Fallback
  return sonnerToast(titleOrProps as ToastT);
} as ToastFunction;

// Now add all the required methods to make it fully compatible
export const toast = Object.assign(toastFn, {
  success: (propsOrTitle: ToastFunctionProps | string) => {
    if (typeof propsOrTitle === 'string') {
      sonnerToast.success(propsOrTitle);
    } else {
      const { title = "Success", description, ...rest } = propsOrTitle;
      sonnerToast.success(title, { description, ...rest });
    }
  },
  
  info: (propsOrTitle: ToastFunctionProps | string) => {
    if (typeof propsOrTitle === 'string') {
      sonnerToast.info(propsOrTitle);
    } else {
      const { title = "Info", description, ...rest } = propsOrTitle;
      sonnerToast.info(title, { description, ...rest });
    }
  },
  
  warning: (propsOrTitle: ToastFunctionProps | string) => {
    if (typeof propsOrTitle === 'string') {
      sonnerToast.warning(propsOrTitle);
    } else {
      const { title = "Warning", description, ...rest } = propsOrTitle;
      sonnerToast.warning(title, { description, ...rest });
    }
  },
  
  error: (propsOrTitle: ToastFunctionProps | string) => {
    if (typeof propsOrTitle === 'string') {
      sonnerToast.error(propsOrTitle);
    } else {
      const { title = "Error", description, ...rest } = propsOrTitle;
      sonnerToast.error(title, { description, ...rest });
    }
  },
  
  custom: (props: ToastT) => sonnerToast(props),
  
  translateKeys: ({ titleKey, descriptionKey }: { titleKey?: string; descriptionKey?: string }) => {
    const { t } = useLanguage();
    sonnerToast.success(
      titleKey ? t(titleKey) : t("common.success"),
      {
        description: descriptionKey ? t(descriptionKey) : undefined
      }
    );
  },
  
  event: {
    bookingSubmitted: () => {
      const { language } = useLanguage();
      const message = language === 'ka' ? 
        "თქვენი ჯავშანი წარმატებით გაიგზავნა" : 
        "Your booking request has been submitted";
        
      sonnerToast.success(language === 'ka' ? "ჯავშანი გაგზავნილია" : "Booking Submitted", {
        description: message
      });
    },
    bookingApproved: () => {
      const { language } = useLanguage();
      const message = language === 'ka' ? 
        "ჯავშანი დადასტურებულია" : 
        "Booking request has been approved";
        
      sonnerToast.success(language === 'ka' ? "ჯავშანი დადასტურებულია" : "Booking Approved", {
        description: message
      });
    },
    bookingRejected: () => {
      const { language } = useLanguage();
      const message = language === 'ka' ? 
        "ჯავშანი უარყოფილია" : 
        "Booking request has been rejected";
        
      sonnerToast.info(language === 'ka' ? "ჯავშანი უარყოფილია" : "Booking Rejected", {
        description: message
      });
    },
    bookingDeleted: () => {
      const { language } = useLanguage();
      const message = language === 'ka' ? 
        "ჯავშანი წაშლილია" : 
        "Booking has been deleted";
        
      sonnerToast.info(language === 'ka' ? "ჯავშანი წაშლილია" : "Booking Deleted", {
        description: message
      });
    },
    newBookingRequest: (count: number = 1) => {
      const { language } = useLanguage();
      const message = language === 'ka' ? 
        `თქვენ გაქვთ ${count} ახალი ჯავშნის მოთხოვნა` : 
        `You have ${count} new booking ${count === 1 ? 'request' : 'requests'}`;
        
      sonnerToast.info(
        language === 'ka' ? "ახალი ჯავშნის მოთხოვნა" : "New Booking Request", 
        { description: message }
      );
    },
    customerCreated: () => {
      const { t } = useLanguage();
      sonnerToast.success(t("common.success"), {
        description: t("customers.customerCreated") || "Customer created successfully"
      });
    },
    customerUpdated: () => {
      const { t } = useLanguage();
      sonnerToast.success(t("common.success"), {
        description: t("customers.customerUpdated") || "Customer updated successfully"
      });
    },
    customerDeleted: () => {
      const { t } = useLanguage();
      sonnerToast.success(t("common.success"), {
        description: t("customers.customerDeleted") || "Customer deleted successfully"
      });
    },
    eventCreated: () => {
      const { t } = useLanguage();
      sonnerToast.success(t("common.success"), {
        description: t("events.eventCreated") || "Event created successfully"
      });
    },
    eventUpdated: () => {
      const { t } = useLanguage();
      sonnerToast.success(t("common.success"), {
        description: t("events.eventUpdated") || "Event updated successfully"
      });
    },
    eventDeleted: () => {
      const { t } = useLanguage();
      sonnerToast.success(t("common.success"), {
        description: t("events.eventDeleted") || "Event deleted successfully"
      });
    }
  },
  
  task: {
    created: () => {
      const { t } = useLanguage();
      sonnerToast.success(t("common.success"), {
        description: t("tasks.taskCreated") || "Task created successfully"
      });
    },
    updated: () => {
      const { t } = useLanguage();
      sonnerToast.success(t("common.success"), {
        description: t("tasks.taskUpdated") || "Task updated successfully"
      });
    },
    deleted: () => {
      const { t } = useLanguage();
      sonnerToast.success(t("common.success"), {
        description: t("tasks.taskDeleted") || "Task deleted successfully"
      });
    },
    statusChanged: () => {
      const { t } = useLanguage();
      sonnerToast.success(t("common.success"), {
        description: t("tasks.taskStatusChanged") || "Task status changed"
      });
    }
  },
  
  note: {
    added: () => {
      const { t } = useLanguage();
      sonnerToast.success(t("common.success"), {
        description: t("notes.noteCreated") || "Note created successfully"
      });
    },
    updated: () => {
      const { t } = useLanguage();
      sonnerToast.success(t("common.success"), {
        description: t("notes.noteUpdated") || "Note updated successfully"
      });
    },
    deleted: () => {
      const { t } = useLanguage();
      sonnerToast.success(t("common.success"), {
        description: t("notes.noteDeleted") || "Note deleted successfully"
      });
    }
  },
  
  reminder: {
    created: () => {
      const { t } = useLanguage();
      sonnerToast.success(t("common.success"), {
        description: t("reminders.created") || "Reminder created successfully"
      });
    },
    updated: () => {
      const { t } = useLanguage();
      sonnerToast.success(t("common.success"), {
        description: t("reminders.updated") || "Reminder updated successfully"
      });
    },
    deleted: () => {
      const { t } = useLanguage();
      sonnerToast.success(t("common.success"), {
        description: t("reminders.deleted") || "Reminder deleted successfully"
      });
    }
  },
  
  saved: () => {
    const { t } = useLanguage();
    sonnerToast.success(t("common.success"), {
      description: t("common.saved") || "Saved successfully"
    });
  },
  deleted: () => {
    const { t } = useLanguage();
    sonnerToast.success(t("common.success"), {
      description: t("common.deleted") || "Deleted successfully"
    });
  },
  updated: () => {
    const { t } = useLanguage();
    sonnerToast.success(t("common.success"), {
      description: t("common.updated") || "Updated successfully"
    });
  },
  copied: () => {
    const { t } = useLanguage();
    sonnerToast.success(t("common.success"), {
      description: t("common.copied") || "Copied to clipboard"
    });
  }
});
