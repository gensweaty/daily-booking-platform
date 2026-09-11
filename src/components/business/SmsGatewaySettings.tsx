import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { Loader2, RefreshCw, Send, Smartphone, Wifi, WifiOff } from "lucide-react";
import { useSmsGateway } from "@/hooks/useSmsGateway";
import { useLanguage } from "@/contexts/LanguageContext";

const COUNTRY_CODES = [
  { code: "+995", label: "Georgia (+995)" },
  { code: "+1", label: "USA / Canada (+1)" },
  { code: "+34", label: "Spain (+34)" },
  { code: "+7", label: "Russia (+7)" },
  { code: "+44", label: "United Kingdom (+44)" },
  { code: "+49", label: "Germany (+49)" },
  { code: "+33", label: "France (+33)" },
  { code: "+90", label: "Türkiye (+90)" },
  { code: "+971", label: "UAE (+971)" },
];

const DEFAULT_CC_BY_LANGUAGE: Record<string, string> = {
  ka: "+995",
  en: "+1",
  es: "+34",
  ru: "+7",
};

const statusVariant = (status: string) => {
  switch (status) {
    case "delivered":
      return "bg-green-100 text-green-800 border-green-200";
    case "sent":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "failed":
    case "expired":
      return "bg-red-100 text-red-800 border-red-200";
    case "cancelled":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-amber-100 text-amber-800 border-amber-200";
  }
};

export const SmsGatewaySettings = () => {
  const { language } = useLanguage();
  const {
    config,
    devices,
    messages,
    loading,
    busy,
    connect,
    disconnect,
    refreshDevices,
    saveSettings,
    sendTest,
    retry,
    loadHistory,
  } = useSmsGateway();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [testCc, setTestCc] = useState(DEFAULT_CC_BY_LANGUAGE[language] || "+995");
  const [testNumber, setTestNumber] = useState("");
  const [testBody, setTestBody] = useState("SmartBookly test message.");

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (config?.default_country_code) setTestCc(config.default_country_code);
  }, [config?.default_country_code]);

  const connected = Boolean(config?.is_connected);

  const run = async (fn: () => Promise<unknown>, okMessage: string) => {
    try {
      await fn();
      toast({ title: okMessage });
    } catch (e) {
      toast({
        title: "Something went wrong",
        description: (e as Error).message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading SMS settings…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" /> SMS Gateway
            </CardTitle>
            <CardDescription>
              Send text messages through your own Android phone using the “SMS Gateway for
              Android” app.
            </CardDescription>
          </div>
          <Badge className={connected ? "bg-green-100 text-green-800 border-green-200" : "bg-muted text-muted-foreground"}>
            {connected ? "Connected" : "Not connected"}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {!connected ? (
            <>
              <ol className="text-sm text-muted-foreground list-decimal pl-5 space-y-1">
                <li>Install “SMS Gateway for Android” on a phone and allow SMS permissions.</li>
                <li>Turn on Cloud Server and set the gateway Online.</li>
                <li>Copy the username and password the app shows and paste them below.</li>
              </ol>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="sms-username">Username</Label>
                  <Input
                    id="sms-username"
                    value={username}
                    autoComplete="off"
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="from the Android app"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sms-password">Password</Label>
                  <Input
                    id="sms-password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="from the Android app"
                  />
                </div>
              </div>
              <Button
                disabled={busy || !username || !password}
                onClick={() =>
                  run(async () => {
                    await connect(username.trim(), password.trim());
                    setPassword("");
                  }, "SMS gateway connected")
                }
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Connect
              </Button>
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-muted-foreground">
                Signed in as <span className="font-medium">{config?.username}</span>
                {config?.last_verified_at && (
                  <> · verified {new Date(config.last_verified_at).toLocaleString()}</>
                )}
              </p>
              <div className="flex gap-2 ml-auto">
                <Button variant="outline" size="sm" disabled={busy} onClick={() => run(refreshDevices, "Devices refreshed")}>
                  <RefreshCw className="h-4 w-4 mr-2" /> Refresh devices
                </Button>
                <Button variant="destructive" size="sm" disabled={busy} onClick={() => run(disconnect, "Disconnected")}>
                  Disconnect
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {connected && (
        <>
          {/* Devices */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Android phones</CardTitle>
              <CardDescription>Messages are sent automatically from an available phone.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {devices.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No phones found yet. Make sure the app is Online, then press “Refresh devices”.
                </p>
              ) : (
                devices.map((d) => (
                  <div key={d.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      {d.is_online ? (
                        <Wifi className="h-4 w-4 text-green-600" />
                      ) : (
                        <WifiOff className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div>
                        <p className="font-medium text-sm">{d.name || d.external_id}</p>
                        <p className="text-xs text-muted-foreground">
                          {d.is_online ? "Online" : "Offline"}
                          {d.last_seen_at && ` · last seen ${new Date(d.last_seen_at).toLocaleString()}`}
                          {Array.isArray(d.sim_cards) && d.sim_cards.length > 0 &&
                            ` · ${d.sim_cards.length} SIM${d.sim_cards.length > 1 ? "s" : ""}`}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}

              <Separator />

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Phone selection</Label>
                  <Select
                    value={config?.routing_mode || "auto"}
                    onValueChange={(v) => run(() => saveSettings({ routing_mode: v }), "Saved")}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Automatic</SelectItem>
                      <SelectItem value="fixed">Always use one phone</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {config?.routing_mode === "fixed" && (
                  <div className="space-y-1.5">
                    <Label>Phone</Label>
                    <Select
                      value={config?.preferred_device_id || ""}
                      onValueChange={(v) => run(() => saveSettings({ preferred_device_id: v }), "Saved")}
                    >
                      <SelectTrigger><SelectValue placeholder="Choose a phone" /></SelectTrigger>
                      <SelectContent>
                        {devices.map((d) => (
                          <SelectItem key={d.external_id} value={d.external_id}>
                            {d.name || d.external_id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Test */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Send a test message</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Select value={testCc} onValueChange={setTestCc}>
                  <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COUNTRY_CODES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={testNumber}
                  onChange={(e) => setTestNumber(e.target.value)}
                  placeholder="555 123 456"
                  inputMode="tel"
                />
              </div>
              <Textarea value={testBody} onChange={(e) => setTestBody(e.target.value)} rows={3} />
              <Button
                disabled={busy || !testNumber.trim()}
                onClick={() =>
                  run(async () => {
                    const msg = await sendTest(`${testCc}${testNumber.trim()}`, testBody, language);
                    if (msg?.status === "failed") throw new Error(msg.error || "Could not send.");
                  }, "Test message queued")
                }
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Send test SMS
              </Button>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Automatic SMS</CardTitle>
              <CardDescription>These use your existing booking and reminder timings.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {([
                ["sms_enabled", "Enable SMS sending"],
                ["send_on_booking_confirmed", "Booking confirmed"],
                ["send_on_reminder", "Appointment reminder"],
                ["send_on_rescheduled", "Booking rescheduled"],
                ["send_on_cancelled", "Booking cancelled"],
              ] as const).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between">
                  <Label htmlFor={key} className="font-normal">{label}</Label>
                  <Switch
                    id={key}
                    checked={Boolean(config?.[key])}
                    disabled={busy || (key !== "sms_enabled" && !config?.sms_enabled)}
                    onCheckedChange={(v) => run(() => saveSettings({ [key]: v } as never), "Saved")}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Advanced */}
          <Accordion type="single" collapsible>
            <AccordionItem value="advanced" className="border rounded-lg px-4">
              <AccordionTrigger className="text-sm font-medium">Advanced</AccordionTrigger>
              <AccordionContent className="space-y-4 pb-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Default country code</Label>
                    <Select
                      value={config?.default_country_code || "+995"}
                      onValueChange={(v) => run(() => saveSettings({ default_country_code: v }), "Saved")}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {COUNTRY_CODES.map((c) => (
                          <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Give up after (minutes)</Label>
                    <Input
                      type="number"
                      min={1}
                      defaultValue={Math.round((config?.message_ttl_seconds || 3600) / 60)}
                      onBlur={(e) =>
                        run(
                          () => saveSettings({ message_ttl_seconds: Math.max(60, Number(e.target.value) * 60) }),
                          "Saved",
                        )
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Quiet hours start (UTC, HH:MM)</Label>
                    <Input
                      defaultValue={config?.quiet_hours_start || ""}
                      placeholder="22:00"
                      onBlur={(e) => run(() => saveSettings({ quiet_hours_start: e.target.value || null }), "Saved")}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Quiet hours end (UTC, HH:MM)</Label>
                    <Input
                      defaultValue={config?.quiet_hours_end || ""}
                      placeholder="08:00"
                      onBlur={(e) => run(() => saveSettings({ quiet_hours_end: e.target.value || null }), "Saved")}
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* History */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-lg">Recent messages</CardTitle>
              <Button variant="outline" size="sm" onClick={() => loadHistory()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {messages.length === 0 ? (
                <p className="text-sm text-muted-foreground">No messages yet.</p>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{m.recipient}</p>
                      <p className="text-xs text-muted-foreground truncate">{m.body}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(m.created_at).toLocaleString()} · {m.purpose.replace(/_/g, " ")}
                        {m.error && ` · ${m.error}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className={statusVariant(m.status)}>{m.status}</Badge>
                      {(m.status === "failed" || m.status === "expired") && (
                        <Button variant="ghost" size="sm" disabled={busy} onClick={() => run(() => retry(m.id), "Retrying")}>
                          Retry
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
