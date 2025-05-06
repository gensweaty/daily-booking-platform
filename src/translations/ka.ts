import { TranslationType } from './types';

export const ka: TranslationType = {
  common: {
    success: "წარმატება",
    error: "შეცდომა",
    errorOccurred: "მოხდა შეცდომა",
    successMessage: "ოპერაცია წარმატებით შესრულდა",
    copiedToClipboard: "კოპირებულია ბუფერში",
    deleteSuccess: "წარმატებით წაიშალა",
    saveSuccess: "წარმატებით შეინახა",
  },
  events: {
    eventCreated: "ღონისძიება წარმატებით შეიქმნა",
    eventUpdated: "ღონისძიება წარმატებით განახლდა",
    eventDeleted: "ღონისძიება წარმატებით წაიშალა",
  },
  bookings: {
    requestApproved: "ჯავშნის მოთხოვნა დადასტურებულია",
    requestRejected: "ჯავშნის მოთხოვნა უარყოფილია",
    requestDeleted: "ჯავშნის მოთხოვნა წაშლილია",
    newRequest: "ჯავშნის მოთხოვნა",
    pendingRequestsCount: "თქვენ გაქვთ {count} ახალი ჯავშნის მოთხოვნა",
    requestSubmitted: "ჯავშნის მოთხოვნა გაიგზავნა",
    requestSubmittedDescription: "დადასტურება მოგივათ მეილზე",
  },
  tasks: {
    taskAdded: "დავალება დამატებულია",
    taskUpdated: "დავალება განახლებულია",
    taskDeleted: "დავალება წაშლილია",
  },
  crm: {
    customerCreated: "მომხმარებელი დამატებულია",
    customerUpdated: "მომხმარებელი განახლებულია",
    customerDeleted: "მომხმარებელი წაშლილია",
  },
  notes: {
    noteAdded: "შენიშვნა დამატებულია",
    noteAddedDescription: "შენიშვნა წარმატებით დაემატა",
    noteUpdated: "შენიშვნა განახლებულია",
    noteDeleted: "შენიშვნა წაშლილია",
  },
  reminders: {
    reminderCreated: "შეხსენება დამატებულია",
  },
  dashboard: {
    exportSuccessful: "ექსპორტი წარმატებით დასრულდა",
    exportSuccessMessage: "მონაცემები წარმატებით ექსპორტირდა",
  },
};
