import { Bot, KeyRound, History, ShieldCheck } from "lucide-react";
import { LanguageText } from "@/components/shared/LanguageText";
import { useLanguage } from "@/contexts/LanguageContext";

const icons = [KeyRound, Bot, ShieldCheck, History];

const copy = {
  en: {
    eyebrow: "Works with AI agents",
    title: "Let your AI assistant run the routine work",
    text: "Connect Claude, ChatGPT, Grok or your own agent to SmartBookly with a personal key. It can add bookings, update customers, move tasks and set reminders — only in your account, and every change is labeled.",
    items: [
      ["Your own key", "Create a key in your profile in one click. Turn it off any time."],
      ["Ready instructions", "Copy the built-in guide to your agent so it knows exactly what it can do."],
      ["Safe by design", "An agent sees only your account and confirms before deleting anything."],
      ["Clear history", "See which agent changed what, and when."],
    ],
  },
  es: {
    eyebrow: "Compatible con agentes de IA",
    title: "Deja que tu asistente de IA haga el trabajo rutinario",
    text: "Conecta Claude, ChatGPT, Grok o tu propio agente a SmartBookly con una clave personal. Puede crear reservas, actualizar clientes, mover tareas y programar recordatorios — solo en tu cuenta, y cada cambio queda identificado.",
    items: [
      ["Tu propia clave", "Crea una clave en tu perfil con un clic. Desactívala cuando quieras."],
      ["Instrucciones listas", "Copia la guía integrada a tu agente para que sepa exactamente qué puede hacer."],
      ["Seguro por diseño", "El agente solo ve tu cuenta y confirma antes de eliminar algo."],
      ["Historial claro", "Mira qué agente cambió qué y cuándo."],
    ],
  },
  ka: {
    eyebrow: "მუშაობს AI აგენტებთან",
    title: "რუტინული საქმე მიანდეთ თქვენს AI ასისტენტს",
    text: "დააკავშირეთ Claude, ChatGPT, Grok ან საკუთარი აგენტი SmartBookly-სთან პირადი გასაღებით. მას შეუძლია ჯავშნების დამატება, მომხმარებლების განახლება, ამოცანების გადატანა და შეხსენებების დაყენება — მხოლოდ თქვენს ანგარიშში, და ყველა ცვლილება მონიშნულია.",
    items: [
      ["საკუთარი გასაღები", "შექმენით გასაღები პროფილში ერთი დაწკაპებით. გამორთეთ ნებისმიერ დროს."],
      ["მზა ინსტრუქცია", "გადაეცით აგენტს ჩაშენებული სახელმძღვანელო, რომ ზუსტად იცოდეს რისი გაკეთება შეუძლია."],
      ["უსაფრთხო", "აგენტი ხედავს მხოლოდ თქვენს ანგარიშს და წაშლამდე ითხოვს დადასტურებას."],
      ["გამჭვირვალე ისტორია", "ნახეთ, რომელმა აგენტმა რა შეცვალა და როდის."],
    ],
  },
};

export const AgentSection = () => {
  const { language } = useLanguage();
  const c = copy[language as keyof typeof copy] || copy.en;
  return (
    <section className="container mx-auto px-4 py-16 sm:py-20" aria-labelledby="agents-title">
      <div className="landing-surface mx-auto max-w-6xl rounded-2xl border border-border p-6 sm:p-10">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            <Bot className="h-4 w-4" /> <LanguageText>{c.eyebrow}</LanguageText>
          </span>
          <h2 id="agents-title" className="mt-4 text-2xl font-bold text-foreground sm:text-4xl">
            <LanguageText>{c.title}</LanguageText>
          </h2>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">
            <LanguageText>{c.text}</LanguageText>
          </p>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {c.items.map(([title, body], i) => {
            const Icon = icons[i];
            return (
              <div key={title} className="landing-tile rounded-xl border border-border p-5">
                <Icon className="h-6 w-6 text-primary" />
                <h3 className="mt-3 font-semibold text-foreground"><LanguageText>{title}</LanguageText></h3>
                <p className="mt-1 text-sm text-muted-foreground"><LanguageText>{body}</LanguageText></p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default AgentSection;
