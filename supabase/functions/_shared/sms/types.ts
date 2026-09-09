// Provider-agnostic SMS contracts for SmartBookly.
// Nothing outside supabase/functions/_shared/sms/ should know which
// SMS provider is in use. To add a provider, implement SmsProvider.

export type SmsStatus =
  | "queued"
  | "sending"
  | "sent"
  | "delivered"
  | "failed"
  | "expired"
  | "cancelled";

export type SmsPurpose =
  | "booking_confirmed"
  | "reminder"
  | "rescheduled"
  | "cancelled"
  | "test"
  | "manual";

export interface SmsCredentials {
  baseUrl: string;
  username?: string | null;
  password?: string | null;
  accessToken?: string | null;
}

export interface SmsDeviceInfo {
  externalId: string;
  name?: string | null;
  lastSeenAt?: string | null;
  isOnline: boolean;
  simCards: Array<{ number: number; label?: string | null }>;
}

export interface SendSmsRequest {
  to: string;
  body: string;
  deviceId?: string | null;
  simNumber?: number | null;
  /** RFC3339 UTC; message is dropped by the gateway if not sent by then. */
  validUntil?: string | null;
  /** RFC3339 UTC; gateway holds the message until this time. */
  scheduleAt?: string | null;
  priority?: number;
}

export interface SendSmsResult {
  ok: boolean;
  providerMessageId?: string;
  status?: SmsStatus;
  /** true when the failure is worth retrying later (offline phone, 5xx, queue full) */
  retryable?: boolean;
  error?: string;
}

export interface SmsStatusResult {
  status: SmsStatus;
  deviceId?: string | null;
  error?: string;
  raw?: unknown;
}

export interface SmsProvider {
  readonly id: string;
  verifyCredentials(creds: SmsCredentials): Promise<{ ok: boolean; error?: string }>;
  /** Exchange username/password for scoped access + refresh tokens (JWT). */
  issueTokens(
    creds: SmsCredentials,
    scopes?: string[],
    ttlSeconds?: number,
  ): Promise<{ accessToken: string; refreshToken: string; expiresAt: string } | null>;
  refreshTokens(
    baseUrl: string,
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string; expiresAt: string } | null>;
  getDevices(creds: SmsCredentials): Promise<SmsDeviceInfo[]>;
  sendSms(creds: SmsCredentials, req: SendSmsRequest): Promise<SendSmsResult>;
  getSmsStatus(creds: SmsCredentials, providerMessageId: string): Promise<SmsStatusResult | null>;
  registerWebhook(
    creds: SmsCredentials,
    url: string,
    event: string,
  ): Promise<{ id: string } | null>;
  deleteWebhook(creds: SmsCredentials, id: string): Promise<boolean>;
}
