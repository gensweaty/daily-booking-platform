// Minimal OpenCall SMS Gateway client — direct browser calls, no backend.
const API = "https://ijrfqjxdajgoaysazxle.supabase.co/rest/v1/rpc";
const KEY = "sb_publishable_Af8dsVLpjtO6Mpe3zpmI9Q_odky49Fh";

export async function gatewayCall(fn: string, body: Record<string, unknown>) {
  const res = await fetch(`${API}/${fn}`, {
    method: "POST",
    headers: { apikey: KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "gateway error");
  return data;
}

export const saveGatewayCreds = (username: string, password: string) =>
  localStorage.setItem("opencall_gw", JSON.stringify({ username, password }));

export const getGatewayCreds = (): { username: string; password: string } | null => {
  try {
    return JSON.parse(localStorage.getItem("opencall_gw") || "null");
  } catch {
    return null;
  }
};

export async function sendSms(to: string, body: string) {
  const creds = getGatewayCreds();
  if (!creds) throw new Error("SMS gateway not configured");
  return gatewayCall("gateway_api_send_sms", {
    p_username: creds.username,
    p_password: creds.password,
    p_to: to,
    p_body: body.slice(0, 1600),
  });
}

export const checkGateway = () => {
  const c = getGatewayCreds();
  if (!c) throw new Error("SMS gateway not configured");
  return gatewayCall("gateway_api_status", {
    p_username: c.username,
    p_password: c.password,
  });
};

export async function sendBulkSms(messages: { to: string; body: string }[]) {
  const creds = getGatewayCreds();
  if (!creds) throw new Error("Gateway not configured");
  if (messages.length === 0) return { queued: 0, messages: [] };
  if (messages.length > 500) {
    const results = [];
    for (let i = 0; i < messages.length; i += 500) {
      results.push(await sendBulkSms(messages.slice(i, i + 500)));
    }
    return { queued: messages.length, messages: results.flatMap((r) => r.messages) };
  }
  const res = await fetch(`${API}/gateway_api_send_bulk`, {
    method: "POST",
    headers: { apikey: KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      p_username: creds.username,
      p_password: creds.password,
      p_messages: messages.map((m) => ({ to: m.to, body: m.body })),
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Bulk send failed");
  return data;
}
