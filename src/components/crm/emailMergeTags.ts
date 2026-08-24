export interface MergeTag {
  token: string;
  label: string;
  resolve: (c: any) => string;
}

const fmtDate = (v?: string) => {
  if (!v) return "";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString();
};

export const MERGE_TAGS: MergeTag[] = [
  { token: "full_name", label: "Full name", resolve: (c) => [c?.title, c?.user_surname].filter(Boolean).join(" ").trim() },
  { token: "first_name", label: "First name", resolve: (c) => String(c?.title || "").trim().split(/\s+/)[0] || "" },
  { token: "surname", label: "Surname", resolve: (c) => c?.user_surname || "" },
  { token: "email", label: "Email", resolve: (c) => c?.social_network_link || "" },
  { token: "phone", label: "Phone", resolve: (c) => c?.user_number || "" },
  { token: "comment", label: "Comment", resolve: (c) => c?.event_notes || "" },
  { token: "payment_status", label: "Payment status", resolve: (c) => String(c?.payment_status || "").replace(/_/g, " ") },
  { token: "payment_amount", label: "Payment amount", resolve: (c) => (c?.payment_amount != null ? String(c.payment_amount) : "") },
  { token: "event_date", label: "Event date", resolve: (c) => fmtDate(c?.start_date) },
  { token: "social_link", label: "Social link", resolve: (c) => c?.social_network_link || "" },
];

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Replaces @tag tokens with the recipient's values. */
export const renderTemplate = (input: string, customer: any, opts?: { html?: boolean }) => {
  if (!input) return "";
  let out = input;
  for (const tag of MERGE_TAGS) {
    const re = new RegExp(`@${tag.token}\\b`, "g");
    if (!re.test(out)) continue;
    let value = (tag.resolve(customer) || "").trim();
    if (!value && tag.token === "full_name") value = "there";
    if (!value && tag.token === "first_name") value = "there";
    out = out.replace(re, opts?.html ? escapeHtml(value) : value);
  }
  return out;
};

export const getCustomerEmail = (c: any): string => {
  const v = String(c?.social_network_link || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : "";
};

export const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

const stripHtml = (s: string) =>
  s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ");

/** Finds which @tokens are used in the text (recognized) and which are unknown. */
export const detectTags = (input: string) => {
  const text = stripHtml(input || "");
  const known = new Set(MERGE_TAGS.map((t) => t.token));
  const used: string[] = [];
  const unknown: string[] = [];
  const matches = text.match(/@[a-zA-Z_]+/g) || [];
  for (const m of matches) {
    const token = m.slice(1);
    if (known.has(token)) {
      if (!used.includes(token)) used.push(token);
    } else if (!unknown.includes(token)) unknown.push(token);
  }
  return { used, unknown };
};

