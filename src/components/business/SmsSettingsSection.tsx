import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import {
  MessageSquare,
  Smartphone,
  Send,
  ExternalLink,
  Zap,
  Loader2,
  Users,
  UserCog,
  ChevronDown,
  Save,
  RotateCcw,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { OpenCallSmsGatewayCard } from "./OpenCallSmsGatewayCard";
import { SmsComposerDialog } from "@/components/crm/SmsComposerDialog";
import {
  DEFAULT_TEMPLATES,
  SMS_AUTO_TOKENS,
  SMS_EVENT_AUDIENCE,
  SmsAutoEvent,
  SmsAutoSettings,
  getSmsAutoSettings,
  saveSmsAutoSettings,
  renderSmsTemplate,
} from "@/lib/smsAutomation";
import { getGatewayCreds, sendSms } from "@/lib/smsGateway";

const OPENCALL_APP_URL = "https://devso3939.github.io/AI-Call-software/app.html";

type Lang = "en" | "es" | "ka";

const COPY: Record<Lang, any> = {
  en: {
    title: "SMS settings",
    subtitle: "Send SMS from your own phone number — everything email does, SMS can do too.",
    howTitle: "How to get started (3 steps)",
    steps: [
      "Install the OpenCall app on the Android phone that will send your messages, and keep that phone online with an active SIM.",
      "In the app open the SMS Gateway tab and create your username and password.",
      "Paste that username and password below, press Save, then Test connection — when your phone name appears, you are ready.",
    ],
    openApp: "Open the OpenCall app page",
    autoTitle: "Automatic SMS notifications",
    autoDesc: "Turn on the messages you want SmartBookly to send by itself. Each one works just like the email version.",
    master: "Enable automatic SMS",
    masterHint: "Nothing is sent while this is off.",
    ownerPhone: "Your phone number (for alerts sent to you)",
    customerGroup: "Messages to your customers",
    customerGroupDesc: "Whenever an email goes to a customer, the same message is texted too — if their phone number is saved.",
    ownerGroup: "Messages to you",
    ownerGroupDesc: "Alerts sent to your own phone number above.",
    edit: "Edit message",
    tokensHint: "Click a tag to add it. Every customer gets their own details instead of the tag.",
    preview: "Preview",
    reset: "Reset to default",
    save: "Save settings",
    saved: "Settings saved",
    bulkTitle: "Send bulk SMS",
    bulkDesc: "Write one personalized message and send it to many people at once, with names and dates filled in automatically.",
    bulkBtn: "Open bulk SMS",
    testTitle: "Send a test SMS",
    testPhone: "Phone number",
    testText: "Message",
    testBtn: "Send test",
    testSent: "Test SMS sent",
    notConnected: "Connect your gateway first (username and password above).",
    on: "On",
    off: "Off",
    events: {
      booking_approved: "Booking approved — confirmation to the customer",
      booking_rejected: "Booking declined — message to the customer",
      booking_request_ack: "Booking request received — confirmation to the customer",
      event_reminder: "Appointment reminder — sent to the customer before the appointment",
      booking_received: "New booking request — alert to your own phone",
    },
  },
  es: {
    title: "Configuración de SMS",
    subtitle: "Envía SMS desde tu propio número: todo lo que hace el correo, también lo hace el SMS.",
    howTitle: "Cómo empezar (3 pasos)",
    steps: [
      "Instala la aplicación OpenCall en el teléfono Android que enviará los mensajes y mantenlo conectado con una SIM activa.",
      "En la aplicación abre la pestaña SMS Gateway y crea tu usuario y contraseña.",
      "Pega ese usuario y contraseña abajo, pulsa Guardar y luego Probar conexión: cuando aparezca el nombre de tu teléfono, ya está listo.",
    ],
    openApp: "Abrir la página de la aplicación OpenCall",
    autoTitle: "Notificaciones SMS automáticas",
    autoDesc: "Activa los mensajes que quieres que SmartBookly envíe solo. Cada uno funciona igual que la versión por correo.",
    master: "Activar SMS automáticos",
    masterHint: "No se envía nada mientras esto esté desactivado.",
    ownerPhone: "Tu número de teléfono (para los avisos que recibes tú)",
    customerGroup: "Mensajes para tus clientes",
    customerGroupDesc: "Cada vez que un correo va a un cliente, también se le envía el mismo mensaje por SMS, si tiene teléfono guardado.",
    ownerGroup: "Mensajes para ti",
    ownerGroupDesc: "Avisos enviados a tu propio número indicado arriba.",
    edit: "Editar mensaje",
    tokensHint: "Haz clic en una etiqueta para añadirla. Cada cliente recibe sus propios datos en lugar de la etiqueta.",
    preview: "Vista previa",
    reset: "Restablecer",
    save: "Guardar ajustes",
    saved: "Ajustes guardados",
    bulkTitle: "Enviar SMS masivos",
    bulkDesc: "Escribe un mensaje personalizado y envíalo a muchas personas a la vez, con nombres y fechas rellenados automáticamente.",
    bulkBtn: "Abrir SMS masivos",
    testTitle: "Enviar un SMS de prueba",
    testPhone: "Número de teléfono",
    testText: "Mensaje",
    testBtn: "Enviar prueba",
    testSent: "SMS de prueba enviado",
    notConnected: "Conecta primero tu pasarela (usuario y contraseña arriba).",
    on: "Activado",
    off: "Desactivado",
    events: {
      booking_approved: "Reserva aprobada — confirmación al cliente",
      booking_rejected: "Reserva rechazada — mensaje al cliente",
      booking_request_ack: "Solicitud de reserva recibida — confirmación al cliente",
      event_reminder: "Recordatorio de cita — enviado al cliente antes de la cita",
      booking_received: "Nueva solicitud de reserva — aviso a tu teléfono",
    },
  },
  ka: {
    title: "SMS პარამეტრები",
    subtitle: "გააგზავნეთ SMS თქვენივე ნომრიდან — ყველაფერი რაც ელფოსტას შეუძლია, SMS-საც შეუძლია.",
    howTitle: "როგორ დავიწყოთ (3 ნაბიჯი)",
    steps: [
      "დააინსტალირეთ OpenCall აპლიკაცია Android ტელეფონზე, რომელიც გააგზავნის შეტყობინებებს, და დატოვეთ ის ინტერნეტში აქტიური SIM-ით.",
      "აპლიკაციაში გახსენით SMS Gateway ჩანართი და შექმენით მომხმარებლის სახელი და პაროლი.",
      "ჩასვით ისინი ქვემოთ, დააჭირეთ შენახვას და შემდეგ კავშირის შემოწმებას — როცა ტელეფონის სახელი გამოჩნდება, მზად ხართ.",
    ],
    openApp: "OpenCall აპლიკაციის გვერდის გახსნა",
    autoTitle: "ავტომატური SMS შეტყობინებები",
    autoDesc: "ჩართეთ შეტყობინებები, რომლებსაც SmartBookly თავად გააგზავნის. თითოეული ისევე მუშაობს, როგორც ელფოსტის ვერსია.",
    master: "ავტომატური SMS-ის ჩართვა",
    masterHint: "სანამ ეს გამორთულია, არაფერი იგზავნება.",
    ownerPhone: "თქვენი ტელეფონის ნომერი (თქვენთვის განკუთვნილი შეტყობინებებისთვის)",
    customerGroup: "შეტყობინებები თქვენს კლიენტებს",
    customerGroupDesc: "როცა კლიენტს ელფოსტა ეგზავნება, იგივე შეტყობინება SMS-ითაც გაიგზავნება — თუ ნომერი შენახულია.",
    ownerGroup: "შეტყობინებები თქვენთვის",
    ownerGroupDesc: "იგზავნება ზემოთ მითითებულ თქვენს ნომერზე.",
    edit: "შეტყობინების რედაქტირება",
    tokensHint: "დააჭირეთ ტეგს ჩასამატებლად. თითოეული კლიენტი მიიღებს საკუთარ მონაცემებს ტეგის ნაცვლად.",
    preview: "გადახედვა",
    reset: "დაბრუნება საწყისზე",
    save: "პარამეტრების შენახვა",
    saved: "პარამეტრები შენახულია",
    bulkTitle: "მასობრივი SMS-ის გაგზავნა",
    bulkDesc: "დაწერეთ ერთი პერსონალიზებული შეტყობინება და გააგზავნეთ ბევრ ადამიანთან ერთდროულად.",
    bulkBtn: "მასობრივი SMS-ის გახსნა",
    testTitle: "სატესტო SMS-ის გაგზავნა",
    testPhone: "ტელეფონის ნომერი",
    testText: "შეტყობინება",
    testBtn: "ტესტის გაგზავნა",
    testSent: "სატესტო SMS გაიგზავნა",
    notConnected: "ჯერ დააკავშირეთ გეითვეი (მომხმარებელი და პაროლი ზემოთ).",
    on: "ჩართული",
    off: "გამორთული",
    events: {
      booking_approved: "ჯავშანი დადასტურდა — დადასტურება კლიენტს",
      booking_rejected: "ჯავშანი უარყოფილია — შეტყობინება კლიენტს",
      booking_request_ack: "ჯავშნის მოთხოვნა მიღებულია — დადასტურება კლიენტს",
      event_reminder: "ვიზიტის შეხსენება — იგზავნება კლიენტს ვიზიტამდე",
      booking_received: "ახალი ჯავშნის მოთხოვნა — შეტყობინება თქვენს ტელეფონზე",
    },
  },
};

const CUSTOMER_EVENTS: SmsAutoEvent[] = [
  "booking_approved",
  "booking_rejected",
  "booking_request_ack",
  "event_reminder",
];
const OWNER_EVENTS: SmsAutoEvent[] = ["booking_received"];
const ALL_EVENTS: SmsAutoEvent[] = [...CUSTOMER_EVENTS, ...OWNER_EVENTS];

const SAMPLE = {
  name: "Anna",
  business: "My Business",
  date: "12 Oct",
  time: "14:00",
  price: "50",
  notes: "-",
};

export const SmsSettingsSection = () => {
  const { language } = useLanguage();
  const lang: Lang = (["en", "es", "ka"].includes(language) ? language : "en") as Lang;
  const copy = COPY[lang];
  const { toast } = useToast();

  const [settings, setSettings] = useState<SmsAutoSettings>(() => getSmsAutoSettings(lang));
  const [openEditor, setOpenEditor] = useState<SmsAutoEvent | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testText, setTestText] = useState("");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setSettings(getSmsAutoSettings(lang));
  }, [lang]);

  const update = (patch: Partial<SmsAutoSettings>) => setSettings((s) => ({ ...s, ...patch }));

  const onSave = () => {
    saveSmsAutoSettings(settings);
    toast({ title: copy.saved });
  };

  const onSendTest = async () => {
    if (!getGatewayCreds()) {
      toast({ title: copy.notConnected, variant: "destructive" });
      return;
    }
    setTesting(true);
    try {
      await sendSms(testPhone.trim(), testText.trim() || "SmartBookly test SMS");
      toast({ title: copy.testSent });
    } catch (e: any) {
      toast({ title: e?.message || "Failed", variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  const previews = useMemo(
    () =>
      Object.fromEntries(
        ALL_EVENTS.map((e) => [e, renderSmsTemplate(settings.templates[e] || "", SAMPLE)])
      ) as Record<SmsAutoEvent, string>,
    [settings.templates]
  );

  const insertToken = (event: SmsAutoEvent, token: string) =>
    setSettings((s) => ({
      ...s,
      templates: { ...s.templates, [event]: `${s.templates[event] || ""}@${token}` },
    }));

  const renderEventRow = (event: SmsAutoEvent) => {
    const on = !!settings.events[event];
    const expanded = openEditor === event;
    return (
      <div
        key={event}
        className={`rounded-xl border transition-colors ${
          on ? "border-primary/40 bg-primary/5" : "border-border bg-card"
        }`}
      >
        <div className="flex items-start justify-between gap-3 p-3.5">
          <div className="min-w-0 space-y-1">
            <Label htmlFor={`sms-${event}`} className="text-sm font-medium leading-snug">
              {copy.events[event]}
            </Label>
            <div className="flex items-center gap-2">
              <Badge variant={on ? "green" : "secondary"} className="h-5 px-2 text-[11px]">
                {on ? copy.on : copy.off}
              </Badge>
              {on && (
                <button
                  type="button"
                  onClick={() => setOpenEditor(expanded ? null : event)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                >
                  {copy.edit}
                  <ChevronDown
                    className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`}
                  />
                </button>
              )}
            </div>
          </div>
          <Switch
            id={`sms-${event}`}
            checked={on}
            disabled={!settings.enabled}
            onCheckedChange={(v) => {
              update({ events: { ...settings.events, [event]: v } });
              setOpenEditor(v ? event : null);
            }}
          />
        </div>

        {on && expanded && (
          <div className="space-y-2.5 border-t border-border/60 p-3.5">
            <Textarea
              value={settings.templates[event] || ""}
              onChange={(e) =>
                update({ templates: { ...settings.templates, [event]: e.target.value } })
              }
              rows={3}
              className="resize-none bg-background text-base md:text-sm"
            />
            <div className="flex flex-wrap items-center gap-1.5">
              {SMS_AUTO_TOKENS.map((token) => (
                <button
                  key={token}
                  type="button"
                  onClick={() => insertToken(event, token)}
                  className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[11px] text-primary transition-colors hover:bg-primary/20"
                >
                  @{token}
                </button>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-2 text-xs text-muted-foreground"
                onClick={() =>
                  update({
                    templates: { ...settings.templates, [event]: DEFAULT_TEMPLATES[lang][event] },
                  })
                }
              >
                <RotateCcw className="h-3 w-3" /> {copy.reset}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{copy.tokensHint}</p>
            <div className="rounded-lg border border-border/60 bg-muted/40 p-2.5 text-xs leading-relaxed">
              <Badge variant="secondary" className="mr-2 h-5 px-2 text-[11px]">
                {copy.preview}
              </Badge>
              {previews[event]}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Getting started */}
      <Card className="overflow-hidden border-primary/20">
        <div className="bg-gradient-to-r from-primary/15 via-primary/5 to-transparent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <MessageSquare className="h-5 w-5" />
              </span>
              {copy.title}
            </CardTitle>
            <CardDescription>{copy.subtitle}</CardDescription>
          </CardHeader>
        </div>
        <CardContent className="space-y-3 pt-5">
          <p className="text-sm font-medium">{copy.howTitle}</p>
          <ol className="space-y-2.5 text-sm text-muted-foreground">
            {copy.steps.map((s: string, i: number) => (
              <li key={i} className="flex gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                  {i + 1}
                </span>
                <span className="leading-relaxed">{s}</span>
              </li>
            ))}
          </ol>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <a href={OPENCALL_APP_URL} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" /> {copy.openApp}
            </a>
          </Button>
        </CardContent>
      </Card>

      {/* Gateway credentials */}
      <OpenCallSmsGatewayCard />

      {/* Automatic notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Zap className="h-5 w-5" />
            </span>
            {copy.autoTitle}
          </CardTitle>
          <CardDescription>{copy.autoDesc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3.5">
            <div className="space-y-0.5">
              <Label htmlFor="sms-auto-master" className="font-medium">
                {copy.master}
              </Label>
              <p className="text-xs text-muted-foreground">{copy.masterHint}</p>
            </div>
            <Switch
              id="sms-auto-master"
              checked={settings.enabled}
              onCheckedChange={(v) => update({ enabled: v })}
            />
          </div>

          {/* Customer messages */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">{copy.customerGroup}</h3>
            </div>
            <p className="text-xs text-muted-foreground">{copy.customerGroupDesc}</p>
            <div className="space-y-2.5">{CUSTOMER_EVENTS.map(renderEventRow)}</div>
          </section>

          {/* Owner messages */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <UserCog className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">{copy.ownerGroup}</h3>
            </div>
            <p className="text-xs text-muted-foreground">{copy.ownerGroupDesc}</p>
            <div className="space-y-1.5">
              <Label htmlFor="sms-owner-phone" className="text-sm">
                {copy.ownerPhone}
              </Label>
              <Input
                id="sms-owner-phone"
                value={settings.ownerPhone}
                placeholder="+995555123456"
                className="text-base md:text-sm"
                onChange={(e) => update({ ownerPhone: e.target.value })}
              />
            </div>
            <div className="space-y-2.5">{OWNER_EVENTS.map(renderEventRow)}</div>
          </section>

          <Button onClick={onSave} className="w-full gap-2 sm:w-auto">
            <Save className="h-4 w-4" /> {copy.save}
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Bulk SMS */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Send className="h-5 w-5 text-primary" /> {copy.bulkTitle}
            </CardTitle>
            <CardDescription>{copy.bulkDesc}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setBulkOpen(true)} className="gap-2">
              <MessageSquare className="h-4 w-4" /> {copy.bulkBtn}
            </Button>
          </CardContent>
        </Card>

        {/* Test SMS */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Smartphone className="h-5 w-5 text-primary" /> {copy.testTitle}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="sms-test-phone">{copy.testPhone}</Label>
              <Input
                id="sms-test-phone"
                value={testPhone}
                placeholder="+995555123456"
                className="text-base md:text-sm"
                onChange={(e) => setTestPhone(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sms-test-text">{copy.testText}</Label>
              <Input
                id="sms-test-text"
                value={testText}
                placeholder="SmartBookly test SMS"
                className="text-base md:text-sm"
                onChange={(e) => setTestText(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              onClick={onSendTest}
              disabled={testing || testPhone.replace(/\D/g, "").length < 6}
              className="gap-2"
            >
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {copy.testBtn}
            </Button>
          </CardContent>
        </Card>
      </div>

      {bulkOpen && (
        <SmsComposerDialog open={bulkOpen} onOpenChange={setBulkOpen} customers={[]} />
      )}
    </div>
  );
};

export default SmsSettingsSection;
