// SMS-Gate compatible gateway client (SMS Gateway for Android).
// Credentials are stored locally and persist until the user disconnects.

export const DEFAULT_SERVER_URL =
  "https://ijrfqjxdajgoaysazxle.supabase.co/functions/v1/smmsgate";

const CREDS_KEY = "opencall_gw";
const TOKEN_KEY = "opencall_gw_token";

export type GatewayCreds = {
  serverUrl: string;
  username: string;
  password: string;
};

export const saveGatewayCreds = (
  username: string,
  password: string,
  serverUrl: string = DEFAULT_SERVER_URL
) => {
  localStorage.setItem(
    CREDS_KEY,
    JSON.stringify({
      serverUrl: (serverUrl || DEFAULT_SERVER_URL).replace(/\/+$/, ""),
      username,
      password,
    })
  );
  localStorage.removeItem(TOKEN_KEY);
};

export const removeGatewayCreds = () => {
  localStorage.removeItem(CREDS_KEY);
  localStorage.removeItem(TOKEN_KEY);
};

export const getGatewayCreds = (): GatewayCreds | null => {
  try {
    const raw = JSON.parse(localStorage.getItem(CREDS_KEY) || "null");
    if (!raw || !raw.username) return null;
    return {
      serverUrl: (raw.serverUrl || DEFAULT_SERVER_URL).replace(/\/+$/, ""),
      username: raw.username,
      password: raw.password || "",
    };
  } catch {
    return null;
  }
};

const requireCreds = (): GatewayCreds => {
  const c = getGatewayCreds();
  if (!c) throw new Error("SMS gateway not configured");
  return c;
};

const basicHeader = (c: GatewayCreds) =>
  `Basic ${btoa(`${c.username}:${c.password}`)}`;

type CachedToken = { token: string; expiresAt: string; username: string };

const readToken = (username: string): string | null => {
  try {
    const t: CachedToken | null = JSON.parse(localStorage.getItem(TOKEN_KEY) || "null");
    if (!t?.token || t.username !== username) return null;
    if (t.expiresAt && new Date(t.expiresAt).getTime() - 30_000 < Date.now()) return null;
    return t.token;
  } catch {
    return null;
  }
};

async function readError(res: Response) {
  const text = await res.text().catch(() => "");
  let message = text;
  try {
    const json = JSON.parse(text);
    message = json.message || json.error || text;
  } catch {
    /* plain text body */
  }
  if (res.status === 401 || res.status === 403) {
    return new Error(
      `Invalid gateway credentials — the username or password was rejected by the server (${res.status}).` +
        (message ? ` Server said: ${message}` : "")
    );
  }
  if (res.status === 404) {
    return new Error(
      `Server address not found (404). Check the Server URL — it must point at your gateway, without /3rdparty at the end.` +
        (message ? ` Server said: ${message}` : "")
    );
  }
  if (res.status === 429) {
    return new Error("Too many requests to the gateway (429). Wait a minute and try again.");
  }
  if (res.status >= 500) {
    return new Error(
      `The gateway server returned an error (${res.status}). The phone app may be offline or not configured.` +
        (message ? ` Server said: ${message}` : "")
    );
  }
  return new Error(message ? `Gateway error (${res.status}): ${message}` : `Gateway error (${res.status})`);
}

/** Network-level failures give an unhelpful "Failed to fetch" — explain them. */
function networkError(url: string, e: unknown) {
  const msg = (e as Error)?.message || String(e);
  if (/failed to fetch|networkerror|load failed/i.test(msg)) {
    return new Error(
      `Could not reach the server at ${url}. Possible reasons: the Server URL is wrong or unreachable, ` +
        `the phone/gateway is offline, there is no internet connection, or the server does not allow requests from this website (CORS).`
    );
  }
  return e instanceof Error ? e : new Error(msg);
}

/** POST /3rdparty/v1/auth/token — returns access token info. */
export async function getAuthToken(creds?: GatewayCreds) {
  const c = creds ?? requireCreds();
  const url = `${c.serverUrl}/3rdparty/v1/auth/token`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { Authorization: basicHeader(c), "Content-Type": "application/json" },
    });
  } catch (e) {
    throw networkError(url, e);
  }
  if (!res.ok) throw await readError(res);
  const data = await res.json().catch(() => ({}));
  if (data?.access_token) {
    localStorage.setItem(
      TOKEN_KEY,
      JSON.stringify({
        token: data.access_token,
        expiresAt: data.expires_at || "",
        username: c.username,
      } satisfies CachedToken)
    );
  }
  return data as { access_token?: string; token_type?: string; expires_at?: string };
}

async function authHeader(c: GatewayCreds): Promise<string> {
  const cached = readToken(c.username);
  if (cached) return `Bearer ${cached}`;
  try {
    const t = await getAuthToken(c);
    if (t?.access_token) return `Bearer ${t.access_token}`;
  } catch (e) {
    if ((e as Error).message === "invalid gateway credentials") throw e;
  }
  return basicHeader(c);
}

export type SentMessage = { id?: string; status?: string; createdAt?: string };

/** POST /3rdparty/v1/messages */
async function postMessage(
  c: GatewayCreds,
  phoneNumbers: string[],
  text: string,
  retry = true
): Promise<SentMessage> {
  const res = await fetch(`${c.serverUrl}/3rdparty/v1/messages`, {
    method: "POST",
    headers: {
      Authorization: await authHeader(c),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      textMessage: { text: text.slice(0, 1600) },
      phoneNumbers,
    }),
  });
  if (res.status === 401 && retry) {
    localStorage.removeItem(TOKEN_KEY);
    return postMessage(c, phoneNumbers, text, false);
  }
  if (!res.ok) throw await readError(res);
  return (await res.json().catch(() => ({}))) as SentMessage;
}

export async function sendSms(to: string, body: string) {
  const c = requireCreds();
  return postMessage(c, [to], body);
}

/** Sends many messages; identical texts are grouped into one request (max 500 numbers). */
export async function sendBulkSms(messages: { to: string; body: string }[]) {
  const c = requireCreds();
  if (messages.length === 0) return { queued: 0, messages: [] as { smsId?: string; to: string }[] };

  const groups = new Map<string, string[]>();
  for (const m of messages) {
    const list = groups.get(m.body) || [];
    list.push(m.to);
    groups.set(m.body, list);
  }

  const sent: { smsId?: string; to: string }[] = [];
  for (const [body, numbers] of groups) {
    for (let i = 0; i < numbers.length; i += 500) {
      const chunk = numbers.slice(i, i + 500);
      const res = await postMessage(c, chunk, body);
      chunk.forEach((to) => sent.push({ smsId: res?.id, to }));
    }
  }
  return { queued: sent.length, messages: sent };
}

/** Test the connection through the auth token endpoint. */
export async function checkGateway(creds?: GatewayCreds) {
  const c = creds ?? requireCreds();
  const t = await getAuthToken(c);
  return {
    ok: true,
    tokenType: t?.token_type || "Basic",
    expiresAt: t?.expires_at,
  };
}
