// SMSGate (SMS Gateway for Android™) provider implementation.
// Public Cloud API: https://api.sms-gate.app/3rdparty/v1
// Docs: https://docs.sms-gate.app  — JWT auth is the recommended method.
//
// This file is the ONLY place that knows SMSGate specifics.

import type {
  SmsCredentials,
  SmsDeviceInfo,
  SmsProvider,
  SmsStatusResult,
  SendSmsRequest,
  SendSmsResult,
} from "./types.ts";

export const SMSGATE_CLOUD_BASE_URL = "https://api.sms-gate.app/3rdparty/v1";

export const SMSGATE_DEFAULT_SCOPES = [
  "messages:send",
  "messages:read",
  "devices:list",
  "webhooks:read",
  "webhooks:write",
];

function authHeader(creds: SmsCredentials): string | null {
  if (creds.accessToken) return `Bearer ${creds.accessToken}`;
  if (creds.username && creds.password) {
    return `Basic ${btoa(`${creds.username}:${creds.password}`)}`;
  }
  return null;
}

async function call(
  creds: SmsCredentials,
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; body: any; text: string }> {
  const auth = authHeader(creds);
  const base = (creds.baseUrl || SMSGATE_CLOUD_BASE_URL).replace(/\/+$/, "");
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(auth ? { Authorization: auth } : {}),
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  return { status: res.status, body, text };
}

function mapState(state: unknown): SmsStatusResult["status"] {
  switch (String(state || "").toLowerCase()) {
    case "delivered":
      return "delivered";
    case "sent":
      return "sent";
    case "failed":
      return "failed";
    case "expired":
      return "expired";
    case "processed":
    case "pending":
    default:
      return "queued";
  }
}

export const smsGateProvider: SmsProvider = {
  id: "smsgate_cloud",

  async verifyCredentials(creds) {
    const { status, body, text } = await call(creds, "/devices");
    if (status >= 200 && status < 300) return { ok: true };
    if (status === 401 || status === 403) {
      return { ok: false, error: "Invalid gateway username or password." };
    }
    return { ok: false, error: body?.message || text || `Gateway error ${status}` };
  },

  async issueTokens(creds, scopes = SMSGATE_DEFAULT_SCOPES, ttlSeconds = 86400) {
    const { status, body } = await call(creds, "/auth/token", {
      method: "POST",
      body: JSON.stringify({ ttl: ttlSeconds, scopes }),
    });
    if (status < 200 || status >= 300 || !body?.access_token) return null;
    return {
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      expiresAt: body.expires_at ||
        new Date(Date.now() + ttlSeconds * 1000).toISOString(),
    };
  },

  async refreshTokens(baseUrl, refreshToken) {
    const base = (baseUrl || SMSGATE_CLOUD_BASE_URL).replace(/\/+$/, "");
    const res = await fetch(`${base}/auth/token/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${refreshToken}`,
      },
    });
    if (!res.ok) return null;
    const body = await res.json().catch(() => null);
    if (!body?.access_token) return null;
    return {
      accessToken: body.access_token,
      refreshToken: body.refresh_token || refreshToken,
      expiresAt: body.expires_at || new Date(Date.now() + 86400_000).toISOString(),
    };
  },

  async getDevices(creds): Promise<SmsDeviceInfo[]> {
    const { status, body } = await call(creds, "/devices");
    if (status < 200 || status >= 300 || !Array.isArray(body)) return [];
    return body.map((d: any) => {
      const lastSeen = d.lastSeen || d.updatedAt || d.createdAt || null;
      const online = lastSeen
        ? Date.now() - new Date(lastSeen).getTime() < 10 * 60 * 1000
        : false;
      const sims = Array.isArray(d.sims)
        ? d.sims.map((s: any, i: number) => ({
          number: typeof s?.number === "number" ? s.number : i + 1,
          label: s?.carrier || s?.name || s?.phoneNumber || null,
        }))
        : typeof d.simCount === "number"
        ? Array.from({ length: d.simCount }, (_, i) => ({ number: i + 1, label: null }))
        : [];
      return {
        externalId: String(d.id),
        name: d.name || null,
        lastSeenAt: lastSeen,
        isOnline: online,
        simCards: sims,
      };
    });
  },

  async sendSms(creds, req: SendSmsRequest): Promise<SendSmsResult> {
    const payload: Record<string, unknown> = {
      textMessage: { text: req.body },
      phoneNumbers: [req.to],
      withDeliveryReport: true,
    };
    if (req.deviceId) payload.deviceId = req.deviceId;
    if (typeof req.simNumber === "number") payload.simNumber = req.simNumber;
    if (req.validUntil) payload.validUntil = req.validUntil;
    if (req.scheduleAt) payload.scheduleAt = req.scheduleAt;
    if (typeof req.priority === "number") payload.priority = req.priority;

    const { status, body, text } = await call(creds, "/messages", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (status >= 200 && status < 300 && body?.id) {
      return {
        ok: true,
        providerMessageId: String(body.id),
        status: mapState(body.state),
      };
    }

    const error = body?.message || text || `Gateway error ${status}`;
    // 5xx, 503 queue-limit and network-ish problems are worth retrying.
    const retryable = status >= 500 || status === 429 || status === 0;
    return { ok: false, retryable, error: String(error).slice(0, 500) };
  },

  async getSmsStatus(creds, providerMessageId) {
    const { status, body } = await call(
      creds,
      `/messages/${encodeURIComponent(providerMessageId)}`,
    );
    if (status < 200 || status >= 300 || !body) return null;
    const recipient = Array.isArray(body.recipients) ? body.recipients[0] : null;
    return {
      status: mapState(body.state),
      deviceId: body.deviceId || null,
      error: recipient?.error || undefined,
      raw: body,
    };
  },

  async registerWebhook(creds, url, event) {
    const { status, body } = await call(creds, "/webhooks", {
      method: "POST",
      body: JSON.stringify({ url, event }),
    });
    if (status < 200 || status >= 300 || !body?.id) return null;
    return { id: String(body.id) };
  },

  async deleteWebhook(creds, id) {
    const { status } = await call(creds, `/webhooks/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    return status >= 200 && status < 300;
  },
};

export function getProvider(_providerId?: string | null) {
  // Only one provider today; the abstraction lets more be added without
  // touching booking / reminder / CRM code.
  return smsGateProvider;
}
