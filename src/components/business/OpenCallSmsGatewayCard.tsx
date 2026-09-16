import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Smartphone, Loader2, Check, Trash2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  saveGatewayCreds,
  getGatewayCreds,
  removeGatewayCreds,
  checkGateway,
} from "@/lib/smsGateway";

type Lang = "en" | "es" | "ka";

const COPY: Record<Lang, Record<string, string>> = {
  en: {
    title: "Phone connection",
    desc: "Create your username & password in the OpenCall app → SMS Gateway tab.",
    link: "OpenCall app",
    username: "Username",
    password: "Password",
    save: "Save",
    update: "Update",
    saved: "Saved ✓",
    test: "Test connection",
    remove: "Remove",
    connected: "Saved on this device",
    notSaved: "Not saved yet",
    bulk: "Bulk: up to 500 SMS per request",
    hint: "Your username and password stay saved until you change or remove them.",
  },
  es: {
    title: "Conexión del teléfono",
    desc: "Crea tu usuario y contraseña en la app OpenCall → pestaña SMS Gateway.",
    link: "Aplicación OpenCall",
    username: "Usuario",
    password: "Contraseña",
    save: "Guardar",
    update: "Actualizar",
    saved: "Guardado ✓",
    test: "Probar conexión",
    remove: "Eliminar",
    connected: "Guardado en este dispositivo",
    notSaved: "Aún no guardado",
    bulk: "Masivo: hasta 500 SMS por solicitud",
    hint: "Tu usuario y contraseña quedan guardados hasta que los cambies o los elimines.",
  },
  ka: {
    title: "ტელეფონის კავშირი",
    desc: "შექმენით მომხმარებელი და პაროლი OpenCall აპში → SMS Gateway ჩანართი.",
    link: "OpenCall აპლიკაცია",
    username: "მომხმარებელი",
    password: "პაროლი",
    save: "შენახვა",
    update: "განახლება",
    saved: "შენახულია ✓",
    test: "კავშირის შემოწმება",
    remove: "წაშლა",
    connected: "შენახულია ამ მოწყობილობაზე",
    notSaved: "ჯერ არ არის შენახული",
    bulk: "მასობრივი: 500-მდე SMS ერთ მოთხოვნაზე",
    hint: "მომხმარებელი და პაროლი შენახული რჩება სანამ არ შეცვლით ან წაშლით.",
  },
};

export const OpenCallSmsGatewayCard = () => {
  const { language } = useLanguage();
  const lang: Lang = (["en", "es", "ka"].includes(language) ? language : "en") as Lang;
  const copy = COPY[lang];

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [stored, setStored] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const c = getGatewayCreds();
    if (c?.username) {
      setUsername(c.username);
      setPassword(c.password || "");
      setStored(true);
    }
  }, []);

  const onSave = () => {
    saveGatewayCreds(username.trim(), password.trim());
    setStored(true);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const onRemove = () => {
    removeGatewayCreds();
    setStored(false);
    setUsername("");
    setPassword("");
    setResult(null);
  };

  const onTest = async () => {
    setTesting(true);
    setResult(null);
    try {
      const d = await checkGateway();
      const dev = (d as any)?.device ?? {};
      setResult({
        ok: true,
        text: `${dev.name || "device"}${dev.online != null ? ` · ${dev.online ? "online" : "offline"}` : ""}${dev.battery != null ? ` · battery ${dev.battery}%` : ""}`,
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
        <CardTitle className="flex flex-wrap items-center gap-2">
          <Smartphone className="h-5 w-5" /> {copy.title}
          <Badge variant={stored ? "green" : "secondary"} className="ml-1">
            {stored ? copy.connected : copy.notSaved}
          </Badge>
        </CardTitle>
        <CardDescription>
          {copy.desc}{" "}
          <a
            href="https://devso3939.github.io/AI-Call-software/app.html"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2"
          >
            {copy.link}
          </a>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="oc-username">{copy.username}</Label>
            <Input
              id="oc-username"
              value={username}
              autoComplete="off"
              className="text-base md:text-sm"
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="oc-password">{copy.password}</Label>
            <Input
              id="oc-password"
              type="password"
              autoComplete="new-password"
              value={password}
              className="text-base md:text-sm"
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={onSave} disabled={!username.trim() || !password.trim()}>
            {saved ? copy.saved : stored ? copy.update : copy.save}
          </Button>
          <Button variant="outline" onClick={onTest} disabled={testing || !username.trim()}>
            {testing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {copy.test}
          </Button>
          {stored && (
            <Button variant="ghost" onClick={onRemove} className="gap-1.5 text-destructive">
              <Trash2 className="h-4 w-4" /> {copy.remove}
            </Button>
          )}
        </div>
        {result && (
          <p className={`text-sm ${result.ok ? "text-green-600" : "text-destructive"}`}>
            {result.text}
          </p>
        )}
        <p className="text-xs text-muted-foreground">{copy.hint}</p>
        <p className="text-sm text-green-600 flex items-center gap-1.5">
          <Check className="h-4 w-4" /> {copy.bulk}
        </p>
      </CardContent>
    </Card>
  );
};
