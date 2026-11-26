import { supabase } from "@/integrations/supabase/client";

// Privacy-friendly page-view tracking: anonymous random IDs, no IP, no personal data.
const TZ_COUNTRY: Record<string, string> = {
  "Asia/Tbilisi": "GE", "Europe/London": "GB", "Europe/Berlin": "DE", "Europe/Paris": "FR",
  "Europe/Madrid": "ES", "Europe/Rome": "IT", "Europe/Kyiv": "UA", "Europe/Kiev": "UA",
  "Europe/Moscow": "RU", "Europe/Istanbul": "TR", "Europe/Warsaw": "PL", "Europe/Amsterdam": "NL",
  "Europe/Brussels": "BE", "Europe/Vienna": "AT", "Europe/Zurich": "CH", "Europe/Stockholm": "SE",
  "Europe/Oslo": "NO", "Europe/Copenhagen": "DK", "Europe/Helsinki": "FI", "Europe/Athens": "GR",
  "Europe/Bucharest": "RO", "Europe/Sofia": "BG", "Europe/Prague": "CZ", "Europe/Budapest": "HU",
  "Europe/Lisbon": "PT", "Europe/Dublin": "IE", "Europe/Minsk": "BY", "Asia/Yerevan": "AM",
  "Asia/Baku": "AZ", "Asia/Dubai": "AE", "Asia/Jerusalem": "IL", "Asia/Tehran": "IR",
  "Asia/Kolkata": "IN", "Asia/Calcutta": "IN", "Asia/Shanghai": "CN", "Asia/Tokyo": "JP",
  "Asia/Seoul": "KR", "Asia/Singapore": "SG", "Asia/Almaty": "KZ", "Asia/Tashkent": "UZ",
  "Australia/Sydney": "AU", "Australia/Melbourne": "AU", "America/Toronto": "CA",
  "America/Vancouver": "CA", "America/Mexico_City": "MX", "America/Sao_Paulo": "BR",
  "America/Argentina/Buenos_Aires": "AR", "America/Bogota": "CO", "America/Lima": "PE",
  "America/Santiago": "CL", "Africa/Cairo": "EG", "Africa/Lagos": "NG", "Africa/Johannesburg": "ZA",
};

function country(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (TZ_COUNTRY[tz]) return TZ_COUNTRY[tz];
    if (tz.startsWith("America/") && !tz.includes("Argentina")) return "US";
    const region = (navigator.language || "").split("-")[1];
    return region && region.length === 2 ? region.toUpperCase() : null;
  } catch { return null; }
}

function device(): string {
  const ua = navigator.userAgent;
  if (/iPad|Tablet/i.test(ua)) return "tablet";
  return /Mobi|Android|iPhone/i.test(ua) ? "mobile" : "desktop";
}

function browser(): string {
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\//.test(ua)) return "Opera";
  if (/SamsungBrowser/.test(ua)) return "Samsung";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua)) return "Safari";
  return "Other";
}

function id(store: Storage, key: string, ttlMs?: number): string {
  const now = Date.now();
  try {
    const raw = store.getItem(key);
    if (raw) {
      const [v, t] = raw.split("|");
      if (!ttlMs || now - Number(t) < ttlMs) { store.setItem(key, `${v}|${now}`); return v; }
    }
    const v = crypto.randomUUID();
    store.setItem(key, `${v}|${now}`);
    return v;
  } catch { return crypto.randomUUID(); }
}

/** Normalise paths so dynamic IDs don't explode the page list. */
export function normalizePath(path: string): string {
  if (path.startsWith("/render/")) return "/render";
  if (path.startsWith("/dashboard")) return "/dashboard";
  return path.replace(/\/+$/, "") || "/";
}

let lastKey = "";
export function trackPageView(pathname: string) {
  if (typeof window === "undefined" || navigator.webdriver) return;
  if (pathname.startsWith("/admin-panel") || pathname.startsWith("/render")) return;
  const path = normalizePath(pathname).slice(0, 300);
  const key = `${path}@${Math.floor(Date.now() / 2000)}`;
  if (key === lastKey) return;
  lastKey = key;
  let referrer_host: string | null = null;
  try {
    const r = document.referrer ? new URL(document.referrer).hostname : "";
    referrer_host = r && r !== location.hostname ? r.replace(/^www\./, "").slice(0, 200) : null;
  } catch { /* ignore */ }
  const row = {
    visitor_id: id(localStorage, "sb_vid"),
    session_id: id(sessionStorage, "sb_sid", 30 * 60 * 1000),
    path, referrer_host, country: country(), device: device(), browser: browser(),
  };
  const send = () => { supabase.from("site_visits" as any).insert(row as any).then(() => {}, () => {}); };
  ("requestIdleCallback" in window ? (window as any).requestIdleCallback : setTimeout)(send);
}
