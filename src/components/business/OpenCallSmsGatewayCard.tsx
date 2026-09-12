import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Smartphone, Loader2 } from "lucide-react";
import { saveGatewayCreds, getGatewayCreds, checkGateway } from "@/lib/smsGateway";

export const OpenCallSmsGatewayCard = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const c = getGatewayCreds();
    if (c) {
      setUsername(c.username);
      setPassword(c.password);
    }
  }, []);

  const onSave = () => {
    saveGatewayCreds(username.trim(), password.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const onTest = async () => {
    setTesting(true);
    setResult(null);
    try {
      const d = await checkGateway();
      const device = d?.device_name || d?.device || d?.name || "device";
      const online = d?.online ?? d?.is_online;
      const battery = d?.battery ?? d?.battery_level;
      setResult({
        ok: true,
        text: `${device}${online != null ? ` · ${online ? "online" : "offline"}` : ""}${battery != null ? ` · battery ${battery}%` : ""}`,
      });
    } catch (e) {
      setResult({ ok: false, text: (e as Error).message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" /> SMS Gateway (OpenCall)
        </CardTitle>
        <CardDescription>
          Create your username &amp; password in the OpenCall app → SMS Gateway tab:{" "}
          <a
            href="https://devso3939.github.io/AI-Call-software/app.html"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2"
          >
            OpenCall app
          </a>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="oc-username">Username</Label>
            <Input
              id="oc-username"
              value={username}
              autoComplete="off"
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="oc-password">Password</Label>
            <Input
              id="oc-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={onSave} disabled={!username.trim() || !password.trim()}>
            {saved ? "Saved ✓" : "Save"}
          </Button>
          <Button variant="outline" onClick={onTest} disabled={testing || !username.trim()}>
            {testing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Test connection
          </Button>
        </div>
        {result && (
          <p className={`text-sm ${result.ok ? "text-green-600" : "text-destructive"}`}>
            {result.text}
          </p>
        )}
      </CardContent>
    </Card>
  );
};
