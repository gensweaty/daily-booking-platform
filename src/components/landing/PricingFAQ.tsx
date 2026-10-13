import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { LanguageText } from "@/components/shared/LanguageText";
import { useLanguage } from "@/contexts/LanguageContext";

const copy = {
  en: {
    title: "Questions about your plan",
    items: [
      ["Can I try SmartBookly before subscribing?", "Yes. A 14-day free trial is included, with no credit card required."],
      ["What is included in both plans?", "Both plans include your business website, bookings, CRM, tasks, analytics, team messages, QR booking and email reminders."],
      ["How does annual pricing compare?", "The monthly plan is $19.99 per month. The annual plan is $199.99 per year — about 17% less than paying monthly for 12 months."],
      ["How many team members are included?", "Five sub-users are included. Additional sub-users cost $2 per month each."],
    ],
  },
  es: {
    title: "Preguntas sobre tu plan",
    items: [
      ["¿Puedo probar SmartBookly antes de suscribirme?", "Sí. Se incluye una prueba gratuita de 14 días, sin tarjeta de crédito."],
      ["¿Qué incluyen ambos planes?", "Ambos planes incluyen tu sitio web, reservas, CRM, tareas, analítica, mensajes de equipo, reservas por QR y recordatorios por correo electrónico."],
      ["¿Cómo se compara el precio anual?", "El plan mensual cuesta $19.99 al mes. El anual cuesta $199.99 al año: aproximadamente un 17% menos que pagar mensualmente durante 12 meses."],
      ["¿Cuántos miembros del equipo se incluyen?", "Se incluyen cinco subusuarios. Cada subusuario adicional cuesta $2 al mes."],
    ],
  },
  ka: {
    title: "კითხვები თქვენი გეგმის შესახებ",
    items: [
      ["შემიძლია SmartBookly გამოწერამდე გამოვცადო?", "დიახ. გათვალისწინებულია 14-დღიანი უფასო საცდელი პერიოდი, საკრედიტო ბარათის გარეშე."],
      ["რას მოიცავს ორივე გეგმა?", "ორივე გეგმა მოიცავს ბიზნეს საიტს, ჯავშნებს, CRM-ს, ამოცანებს, ანალიტიკას, გუნდის შეტყობინებებს, QR ჯავშნებსა და ელფოსტით შეხსენებებს."],
      ["როგორ განსხვავდება წლიური ფასი?", "ყოველთვიური გეგმა თვეში $19.99 ღირს. წლიური გეგმა წელიწადში $199.99 ღირს — დაახლოებით 17%-ით ნაკლები, ვიდრე 12 თვის ყოველთვიური გადახდა."],
      ["გუნდის რამდენი წევრი შედის გეგმაში?", "გეგმაში შედის ხუთი დაქვემდებარებული მომხმარებელი. თითო დამატებითი მომხმარებელი თვეში $2 ღირს."],
    ],
  },
};

export const PricingFAQ = () => {
  const { language } = useLanguage();
  const content = copy[language] || copy.en;
  return (
    <div className="mx-auto mt-14 max-w-4xl border-t border-border pt-8 sm:mt-16">
      <h3 className="mb-4 text-xl font-semibold text-foreground sm:text-2xl">
        <LanguageText>{content.title}</LanguageText>
      </h3>
      <Accordion type="single" collapsible>
        {content.items.map(([question, answer], index) => (
          <AccordionItem key={index} value={`question-${index}`} className="border-border">
            <AccordionTrigger className="gap-4 text-left text-base leading-relaxed hover:no-underline hover:text-primary">
              <LanguageText>{question}</LanguageText>
            </AccordionTrigger>
            <AccordionContent className="max-w-3xl text-base leading-relaxed text-muted-foreground">
              <LanguageText>{answer}</LanguageText>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
};