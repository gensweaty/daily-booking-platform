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
  DEFAULT_SERVER_URL,
} from "@/lib/smsGateway";

type Lang = "en" | "es" | "ka";

const COPY: Record<Lang, Record<string, string>> = {
  en: {
    title: "Phone connection",
    desc: "Install the SMS Gateway app on your Android phone, then enter the server address, username and password it shows.",
    link: "SMS Gateway app",
    server: "Server URL",
    username: "Username",
    password: "Password",
    save: "Save",
    update: "Update",
    saved: "Saved ✓",
    test: "Test connection",
    remove: "Disconnect",
    connected: "Saved on this device",
    notSaved: "Not saved yet",
    bulk: "Bulk: up to 500 numbers per request",
    hint: "Your details stay saved until you change them or disconnect.",
    ok: "Connection successful",
  },
  es: {
    title: "Conexión del teléfono",
    desc: "Instala la app SMS Gateway en tu teléfono Android e introduce la dirección del servidor, el usuario y la contraseña que muestra.",
    link: "Aplicación SMS Gateway",
    server: "URL del servidor",
    username: "Usuario",
    password: "Contraseña",
    save: "Guardar",
    update: "Actualizar",
    saved: "Guardado ✓",
    test: "Probar conexión",
    remove: "Desconectar",
    connected: "Guardado en este dispositivo",
    notSaved: "Aún no guardado",
    bulk: "Masivo: hasta 500 números por solicitud",
    hint: "Tus datos quedan guardados hasta que los cambies o te desconectes.",
    ok: "Conexión correcta",
  },
  ka: {
    title: "ტელეფონის კავშირი",
    desc: "დააინსტალირეთ SMS Gateway აპი Android ტელეფონზე და შეიყვანეთ სერვერის მისამართი, მომხმარებელი და პაროლი.",
    link: "SMS Gateway აპლიკაცია",
    server: "სერვერის URL",
    username: "მომხმარებელი",
    password: "პაროლი",
    save: "შენახვა",
    update: "განახლება",
    saved: "შენახულია ✓",
    test: "კავშირის შემოწმება",
    remove: "გათიშვა",
    connected: "შენახულია ამ მოწყობილობაზე",
    notSaved: "ჯერ არ არის შენახული",
    bulk: "მასობრივი: 500-მდე ნომერი ერთ მოთხოვნაზე",
    hint: "მონაცემები შენახული რჩება სანამ არ შეცვლით ან გათიშავთ.",
    ok: "კავშირი წარმატებულია",
  },
};

export const OpenCallSmsGatewayCard = () => {
  const { language } = useLanguage();
  const lang: Lang = (["en", "es", "ka"].includes(language) ? language : "en") as Lang;
  const copy = COPY[lang];

  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER_URL);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [stored, setStored] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const c = getGatewayCreds();
    if (c?.username) {
      setServerUrl(c.serverUrl || DEFAULT_SERVER_URL);
      setUsername(c.username);
      setPassword(c.password || "");
      setStored(true);
    }
  }, []);

  const onSave = () => {
    saveGatewayCreds(username.trim(), password.trim(), serverUrl.trim() || DEFAULT_SERVER_URL);
    setStored(true);
    setSaved(true);
    setResult(null);
    setTimeout(() => setSaved(false), 2000);
  };

  const onRemove = () => {
    removeGatewayCreds();
    setStored(false);
    setUsername("");
    setPassword("");
    setServerUrl(DEFAULT_SERVER_URL);
    setResult(null);
  };

  const onTest = async () => {
    setTesting(true);
    setResult(null);
    try {
      const r = await checkGateway({
        serverUrl: (serverUrl.trim() || DEFAULT_SERVER_URL).replace(/\/+$/, ""),
        username: username.trim(),
        password: password.trim(),
      });
      setResult({
        ok: true,
        text: `${copy.ok}${r.expiresAt ? ` · ${new Date(r.expiresAt).toLocaleString()}` : ""}`,
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
        <div className="space-y-1.5">
          <Label htmlFor="oc-server">{copy.server}</Label>
          <Input
            id="oc-server"
            value={serverUrl}
            autoComplete="off"
            className="text-base md:text-sm"
            onChange={(e) => setServerUrl(e.target.value)}
          />
        </div>
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
            <div className="relative">
              <Input
                id="oc-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                className="text-base md:text-sm pr-10"
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? copy.hidePassword : copy.showPassword}
                title={showPassword ? copy.hidePassword : copy.showPassword}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={onSave} disabled={!username.trim() || !password.trim()}>
            {saved ? copy.saved : stored ? copy.update : copy.save}
          </Button>
          <Button
            variant="outline"
            onClick={onTest}
            disabled={testing || !username.trim() || !password.trim()}
          >
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
