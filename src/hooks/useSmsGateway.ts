import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SmsConfigPublic {
  id: string;
  provider: string;
  base_url: string;
  username: string | null;
  is_connected: boolean;
  sms_enabled: boolean;
  send_on_booking_confirmed: boolean;
  send_on_reminder: boolean;
  send_on_rescheduled: boolean;
  send_on_cancelled: boolean;
  routing_mode: string;
  preferred_device_id: string | null;
  preferred_sim_number: number | null;
  default_country_code: string;
  message_ttl_seconds: number;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  rate_limit_per_minute: number | null;
  last_verified_at: string | null;
  last_error: string | null;
}

export interface SmsDevice {
  id: string;
  external_id: string;
  name: string | null;
  is_online: boolean;
  last_seen_at: string | null;
  sim_cards: Array<{ number: number; label?: string | null }>;
  enabled: boolean;
}

export interface SmsMessage {
  id: string;
  recipient: string;
  body: string;
  purpose: string;
  status: string;
  error: string | null;
  created_at: string;
  sent_at: string | null;
  delivered_at: string | null;
}

/** All SMS gateway traffic goes through the sms-admin edge function. */
export const useSmsGateway = () => {
  const [config, setConfig] = useState<SmsConfigPublic | null>(null);
  const [devices, setDevices] = useState<SmsDevice[]>([]);
  const [messages, setMessages] = useState<SmsMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const call = useCallback(async (action: string, payload: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke("sms-admin", {
      body: { action, ...payload },
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data || {};
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = await call("status");
      setConfig(data.config || null);
      setDevices(data.devices || []);
    } catch (e) {
      console.error("sms status error:", e);
    } finally {
      setLoading(false);
    }
  }, [call]);

  const loadHistory = useCallback(async () => {
    try {
      const data = await call("history", { limit: 50 });
      setMessages(data.messages || []);
    } catch (e) {
      console.error("sms history error:", e);
    }
  }, [call]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const withBusy = async <T,>(fn: () => Promise<T>): Promise<T> => {
    setBusy(true);
    try {
      return await fn();
    } finally {
      setBusy(false);
    }
  };

  const connect = (username: string, password: string, baseUrl?: string) =>
    withBusy(async () => {
      const data = await call("connect", { username, password, base_url: baseUrl });
      setConfig(data.config || null);
      setDevices(data.devices || []);
    });

  const disconnect = () =>
    withBusy(async () => {
      const data = await call("disconnect");
      setConfig(data.config || null);
      setDevices([]);
    });

  const refreshDevices = () =>
    withBusy(async () => {
      const data = await call("refresh_devices");
      setDevices(data.devices || []);
    });

  const saveSettings = (settings: Partial<SmsConfigPublic>) =>
    withBusy(async () => {
      const data = await call("save_settings", { settings });
      setConfig(data.config || null);
    });

  const sendTest = (to: string, body: string, language?: string) =>
    withBusy(async () => {
      const data = await call("send_test", { to, body, language });
      await loadHistory();
      return data.message as SmsMessage | undefined;
    });

  const retry = (id: string) =>
    withBusy(async () => {
      await call("retry", { id });
      await loadHistory();
    });

  return {
    config,
    devices,
    messages,
    loading,
    busy,
    refresh,
    loadHistory,
    connect,
    disconnect,
    refreshDevices,
    saveSettings,
    sendTest,
    retry,
  };
};
