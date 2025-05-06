
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

// Create a standalone toast object that can be imported directly
// This makes it easier to use in places where hook usage isn't possible
export const toast = {
  // Make the object callable itself
  // @ts-ignore - we're handling this dynamically
  (...props: any[]): string | number {
    return sonnerToast(...props);
  },
  success: ({ title = "Success", description, ...props }: ExternalToast) => {
    sonnerToast.success(title, {
      description,
      ...props
    });
  },
  info: ({ title = "Info", description, ...props }: ExternalToast) => {
    sonnerToast.info(title, {
      description,
      ...props
    });
  },
  warning: ({ title = "Warning", description, ...props }: ExternalToast) => {
    sonnerToast.warning(title, {
      description,
      ...props
    });
  },
  error: ({ title = "Error", description, ...props }: ExternalToast) => {
    sonnerToast.error(title, {
      description,
      ...props
    });
  },
  custom: (props: ToastT) => sonnerToast(props),
  // Event-specific toast notifications
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
  // Add missing categories that cause errors
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
        description: t("reminders.created") || "Reminder created"
      });
    },
    updated: () => {
      const { t } = useLanguage();
      sonnerToast.success(t("common.success"), {
        description: t("reminders.updated") || "Reminder updated"
      });
    },
    deleted: () => {
      const { t } = useLanguage();
      sonnerToast.success(t("common.success"), {
        description: t("reminders.deleted") || "Reminder deleted"
      });
    }
  }
};
