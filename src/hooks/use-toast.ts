
import { toast as sonnerToast, ToastT, ExternalToast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { ReactNode } from "react";

// Define custom toast props type
type CustomToastProps = {
  title?: string | ReactNode;
  description?: string | ReactNode;
  variant?: "default" | "destructive";
  [key: string]: any;
};

// Type for our toast function inputs
type ToastInput = string | CustomToastProps;

export const useToast = () => {
  const { t, language } = useLanguage();
  
  // Create a callable toast function that handles different input types
  const toast = (props: ToastInput, options?: Partial<CustomToastProps>) => {
    // Handle string title with optional options
    if (typeof props === 'string') {
      return sonnerToast(props, options);
    }
    
    // Handle object with title and description
    if (props && typeof props === 'object') {
      const { title, description, variant, ...rest } = props;
      
      // Handle variant property for error styling
      if (variant === "destructive") {
        return sonnerToast.error(title as string, { description, ...rest });
      } else {
        return sonnerToast(title as string, { description, ...rest });
      }
    }
    
    // Fallback (should not reach here due to types)
    return sonnerToast(props as unknown as string);
  };
  
  return {
    toast: Object.assign(toast, {
      success: (propsOrTitle: string | Partial<CustomToastProps>) => {
        // Handle string input
        if (typeof propsOrTitle === 'string') {
          sonnerToast.success(propsOrTitle);
          return;
        }
        
        // Handle object input
        const { title = t("common.success"), description, ...props } = propsOrTitle;
        sonnerToast.success(title as string, {
          description,
          ...props
        });
      },
      info: (propsOrTitle: string | Partial<CustomToastProps>) => {
        if (typeof propsOrTitle === 'string') {
          sonnerToast.info(propsOrTitle);
          return;
        }
        
        const { title = t("common.info"), description, ...props } = propsOrTitle;
        sonnerToast.info(title as string, {
          description,
          ...props
        });
      },
      warning: (propsOrTitle: string | Partial<CustomToastProps>) => {
        if (typeof propsOrTitle === 'string') {
          sonnerToast.warning(propsOrTitle);
          return;
        }
        
        const { title = t("common.warning"), description, ...props } = propsOrTitle;
        sonnerToast.warning(title as string, {
          description,
          ...props
        });
      },
      error: (propsOrTitle: string | Partial<CustomToastProps>) => {
        if (typeof propsOrTitle === 'string') {
          sonnerToast.error(propsOrTitle);
          return;
        }
        
        const { title = t("common.error"), description, ...props } = propsOrTitle;
        sonnerToast.error(title as string, {
          description,
          ...props
        });
      },
      custom: (props: string | CustomToastProps) => {
        if (typeof props === 'string') {
          return sonnerToast(props);
        }
        return sonnerToast(props.title as string, props);
      },
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
      },
      translateKeys: ({ titleKey, descriptionKey }: { titleKey?: string; descriptionKey?: string }) => {
        const { t } = useLanguage();
        sonnerToast.success(
          titleKey ? t(titleKey) : t("common.success"),
          {
            description: descriptionKey ? t(descriptionKey) : undefined
          }
        );
      }
    })
  };
};

// Define the toast function interface
interface ToastFunctionProps {
  title?: string | ReactNode;
  description?: string | ReactNode;
  variant?: "default" | "destructive";
  [key: string]: any;
}

interface ToastFunction {
  (props: ToastInput): ReturnType<typeof sonnerToast>;
  (title: string, props?: Partial<CustomToastProps>): ReturnType<typeof sonnerToast>;
  success: (propsOrTitle: string | Partial<CustomToastProps>) => void;
  info: (propsOrTitle: string | Partial<CustomToastProps>) => void;
  warning: (propsOrTitle: string | Partial<CustomToastProps>) => void;
  error: (propsOrTitle: string | Partial<CustomToastProps>) => void;
  custom: (props: ToastInput) => ReturnType<typeof sonnerToast>;
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

// Create a callable function that can be used both as a function and an object
const toastFn = function(
  propsOrTitle: ToastInput,
  options?: Partial<CustomToastProps>
): ReturnType<typeof sonnerToast> {
  // Handle string title with optional props
  if (typeof propsOrTitle === 'string') {
    return sonnerToast(propsOrTitle, options || {});
  }
  
  // Handle object with title and description
  if (propsOrTitle && typeof propsOrTitle === 'object') {
    const { title, description, variant, ...rest } = propsOrTitle as ToastFunctionProps;

    // Special case for translateKeys
    if ('translateKeys' in propsOrTitle) {
      const { translateKeys } = propsOrTitle as any;
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
      return sonnerToast(title as string, { description, ...rest });
    }
  }
  
  // This should never be reached due to TypeScript
  return sonnerToast(propsOrTitle as unknown as string);
} as ToastFunction;

// Add all the required methods to make the toast function fully compatible
export const toast = Object.assign(toastFn, {
  success: (propsOrTitle: string | Partial<CustomToastProps>) => {
    if (typeof propsOrTitle === 'string') {
      sonnerToast.success(propsOrTitle);
    } else {
      const { title = "Success", description, ...props } = propsOrTitle;
      sonnerToast.success(title as string, { description, ...props });
    }
  },
  
  info: (propsOrTitle: string | Partial<CustomToastProps>) => {
    if (typeof propsOrTitle === 'string') {
      sonnerToast.info(propsOrTitle);
    } else {
      const { title = "Info", description, ...props } = propsOrTitle;
      sonnerToast.info(title as string, { description, ...props });
    }
  },
  
  warning: (propsOrTitle: string | Partial<CustomToastProps>) => {
    if (typeof propsOrTitle === 'string') {
      sonnerToast.warning(propsOrTitle);
    } else {
      const { title = "Warning", description, ...props } = propsOrTitle;
      sonnerToast.warning(title as string, { description, ...props });
    }
  },
  
  error: (propsOrTitle: string | Partial<CustomToastProps>) => {
    if (typeof propsOrTitle === 'string') {
      sonnerToast.error(propsOrTitle);
    } else {
      const { title = "Error", description, ...props } = propsOrTitle;
      sonnerToast.error(title as string, { description, ...props });
    }
  },
  
  custom: (propsOrTitle: ToastInput) => {
    if (typeof propsOrTitle === 'string') {
      return sonnerToast(propsOrTitle);
    }
    const { title, ...rest } = propsOrTitle;
    return sonnerToast(title as string, rest);
  },
  
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
