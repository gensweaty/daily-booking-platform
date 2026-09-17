// Automatic SMS notifications — settings + template rendering.
// Stored locally per browser (no backend changes). Never throws into caller flows.
import { sendSms, getGatewayCreds } from "@/lib/smsGateway";

export type SmsAutoEvent =
  | "booking_approved"
  | "booking_rejected"
  | "booking_request_ack"
  | "booking_received"
  | "event_reminder";

/** Who each message goes to: the customer, or the business owner. */
export const SMS_EVENT_AUDIENCE: Record<SmsAutoEvent, "customer" | "owner"> = {
  booking_approved: "customer",
  booking_rejected: "customer",
  booking_request_ack: "customer",
  event_reminder: "customer",
  booking_received: "owner",
};


export interface SmsAutoSettings {
  enabled: boolean;
  ownerPhone: string;
  events: Record<SmsAutoEvent, boolean>;
  templates: Record<SmsAutoEvent, string>;
}

const STORAGE_KEY = "smartbookly_sms_auto";

type Lang = "en" | "es" | "ka";

export const DEFAULT_TEMPLATES: Record<Lang, Record<SmsAutoEvent, string>> = {
  en: {
    booking_approved:
      "Hi @name, your booking at @business on @date at @time is confirmed. See you soon!",
    booking_rejected:
      "Hi @name, unfortunately your booking request at @business for @date at @time could not be accepted. Please contact us for another time.",
    booking_request_ack:
      "Hi @name, we received your booking request at @business for @date at @time. We will confirm it shortly.",
    booking_received:
      "New booking request: @name — @date at @time. Open SmartBookly to approve or reject.",
    event_reminder:
      "Reminder: @name, you have an appointment at @business on @date at @time.",
  },
  es: {
    booking_approved:
      "Hola @name, tu reserva en @business el @date a las @time está confirmada. ¡Nos vemos!",
    booking_rejected:
      "Hola @name, lamentablemente tu solicitud de reserva en @business para el @date a las @time no pudo aceptarse. Contáctanos para otro horario.",
    booking_request_ack:
      "Hola @name, recibimos tu solicitud de reserva en @business para el @date a las @time. La confirmaremos en breve.",
    booking_received:
      "Nueva solicitud de reserva: @name — @date a las @time. Abre SmartBookly para aprobar o rechazar.",
    event_reminder:
      "Recordatorio: @name, tienes una cita en @business el @date a las @time.",
  },
  ka: {
    booking_approved:
      "გამარჯობა @name, თქვენი ჯავშანი @business-ში @date @time დადასტურებულია. მალე შევხვდებით!",
    booking_rejected:
      "გამარჯობა @name, სამწუხაროდ თქვენი ჯავშნის მოთხოვნა @business-ში @date @time ვერ დადასტურდა. გთხოვთ დაგვიკავშირდეთ სხვა დროისთვის.",
    booking_request_ack:
      "გამარჯობა @name, მივიღეთ თქვენი ჯავშნის მოთხოვნა @business-ში @date @time. მალე დაგიდასტურებთ.",
    booking_received:
      "ახალი ჯავშნის მოთხოვნა: @name — @date @time. გახსენით SmartBookly დასადასტურებლად.",
    event_reminder:
      "შეხსენება: @name, თქვენ გაქვთ ვიზიტი @business-ში @date @time.",
  },
};

export const SMS_AUTO_TOKENS = ["name", "business", "date", "time", "price", "notes"] as const;

export const defaultSmsAutoSettings = (lang: Lang = "en"): SmsAutoSettings => ({
  enabled: false,
  ownerPhone: "",
  events: {
    booking_approved: true,
    booking_rejected: false,
    booking_received: false,
    event_reminder: false,
  },
  templates: { ...DEFAULT_TEMPLATES[lang] },
});

export const getSmsAutoSettings = (lang: Lang = "en"): SmsAutoSettings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSmsAutoSettings(lang);
    const parsed = JSON.parse(raw);
    const base = defaultSmsAutoSettings(lang);
    return {
      ...base,
      ...parsed,
      events: { ...base.events, ...(parsed?.events || {}) },
      templates: { ...base.templates, ...(parsed?.templates || {}) },
    };
  } catch {
    return defaultSmsAutoSettings(lang);
  }
};

export const saveSmsAutoSettings = (settings: SmsAutoSettings) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
};

export const renderSmsTemplate = (template: string, vars: Record<string, string | undefined>) =>
  (template || "").replace(/@([a-zA-Z_]+)/g, (match, token: string) => {
    const value = vars[token];
    return value != null && value !== "" ? String(value) : match;
  });

/**
 * Sends an automatic SMS if the owner enabled it. Never throws —
 * booking/reminder flows must keep working when SMS fails.
 */
export const sendAutoSms = async (
  event: SmsAutoEvent,
  phone: string | null | undefined,
  vars: Record<string, string | undefined>,
  lang: Lang = "en"
): Promise<boolean> => {
  try {
    const settings = getSmsAutoSettings(lang);
    if (!settings.enabled || !settings.events[event]) return false;
    if (!getGatewayCreds()) return false;
    const to = (phone || "").trim();
    if (to.replace(/\D/g, "").length < 6) return false;
    const body = renderSmsTemplate(settings.templates[event], vars).slice(0, 1600);
    if (!body.trim()) return false;
    await sendSms(to, body);
    return true;
  } catch (e) {
    console.warn("[sms-auto] send failed", e);
    return false;
  }
};
