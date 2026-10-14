import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Check } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "@/components/shared/LanguageText";
import { useAuth } from "@/contexts/AuthContext";
import { createCheckoutSession } from "@/utils/stripeUtils";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { PricingFAQ } from "./PricingFAQ";

export const PricingSection = () => {
  const [isYearly, setIsYearly] = useState(false);
  const [loading, setLoading] = useState<'monthly' | 'yearly' | null>(null);
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubscribe = async (planType: 'monthly' | 'yearly') => {
    if (!user) {
      navigate('/signup');
      return;
    }
    
    setLoading(planType);
    
    try {
      console.log(`Initiating checkout for ${planType} plan`);
      const data = await createCheckoutSession(planType);
      
      if (data?.url) {
        console.log('Redirecting to Stripe checkout:', data.url);
        window.location.href = data.url;
      } else {
        console.error('No checkout URL returned');
        toast({
          title: "Error",
          description: "Failed to create checkout session - no URL returned",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      toast({
        title: "Subscription Error",
        description: `Could not start subscription process: ${errorMessage.substring(0, 100)}`,
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  // Use USD pricing for all languages
  const monthlyPrice = '$19.99';
  const yearlyPrice = '$199.99';
  const monthlyOriginalPrice = '$39.99';
  const yearlyOriginalPrice = '$399.99';

  const features = language === 'ka' ? [
    'უფასო საიტი თქვენი ბიზნესისთვის',
    'ულიმიტო ლაივ ჯავშნები',
    'ულიმიტო CRM მომხმარებლები',
    'ულიმიტო ამოცანები ბორდზე',
    'ყოვლისმომცველი ანალიტიკა',
    'ულიმიტო ჯავშნების დასტური ემაილით',
    'QR კოდით სწრაფი დაჯავშნის სისტემა',
    'შეუზღუდავი დავალებების შეხსენებები ელექტრონული ფოსტით',
    'ულიმიტო შეტყობინებები მთელ გუნდში',
    'გუნდური თანამშრომლობა დამატებითი გადასახადის გარეშე, 5+  დაქვემდებარებულ თანამშრომელთან, იდეალური პატარა გუნდებისთვის (2$/თვე თითო მომხმარებელზე თუ მეტი გჭირდებათ)',
    'თანამედროვე, ყველა დევაისზე ოპტიმიზირებული სამართავი პანელი'
  ] : language === 'es' ? [
    'Sitio web gratuito para su negocio',
    'Reservas en vivo ilimitadas',
    'Clientes CRM ilimitados',
    'Tareas ilimitadas en el tablero',
    'Analítica integral',
    'Aprobaciones de reserva ilimitadas con correo electrónico',
    'Sistema de reserva rápida con código QR',
    'Recordatorios de tareas ilimitados por correo electrónico',
    'Mensajes ilimitados en todo el equipo',
    'Colaboración entre equipos, 5 subusuarios gratuitos, perfecto para equipos pequeños (2$/mes por usuario adicional si se necesitan más)',
    'Panel de control moderno y responsivo para cualquier dispositivo'
  ] : [
    'Free website for your business',
    'Unlimited live bookings',
    'Unlimited CRM customers',
    'Unlimited tasks on board',
    'Comprehensive Analytics',
    'Unlimited Booking approvals with email',
    'QR code fast booking system',
    'Unlimited Task Reminders With email',
    'Unlimited messages across the whole team',
    'Cross-team collaboration, 5 free sub users, perfect for small teams (2$/mo per user if more needed)',
    'Modern, responsive dashboard for any device'
  ];

  // Get the cheaper text based on language
  const getCheaperText = () => {
    switch (language) {
      case 'ka':
        return '17%-ით იაფი ყოველთვიურზე';
      case 'es':
        return '17% más barato que el mensual';
      default:
        return '17% cheaper than monthly';
    }
  };

  return (
    <section id="pricing" className="border-t border-border py-16 sm:py-20 bg-muted/30 text-foreground relative">
      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center mb-10">
          <h2 className="landing-title text-3xl md:text-4xl font-bold mb-4">
            <LanguageText>{t('cta.title')}</LanguageText>
          </h2>
          <p className="text-lg text-muted-foreground mb-6 max-w-2xl mx-auto">
            <LanguageText>{t('cta.subtitle')}</LanguageText>
          </p>
          
          {/* Free Trial Badge on its own line */}
          <div className="mb-4">
            <div className="bg-secondary/10 text-secondary px-4 py-2 rounded-full text-base font-semibold inline-block">
              <LanguageText>{t('subscription.freeTrial')}</LanguageText>
            </div>
          </div>
          
          {/* Pricing Toggle on separate line */}
          <div className="inline-flex max-w-full flex-wrap items-center justify-center gap-2 rounded-lg border border-border bg-background p-2">
            <Button variant="ghost" onClick={() => setIsYearly(false)} aria-pressed={!isYearly} className={`h-auto min-h-10 whitespace-normal px-3 py-2 text-sm font-medium ${!isYearly ? 'text-foreground bg-muted' : 'text-muted-foreground'}`}>
              <LanguageText>{t('subscription.monthlyPlan')}</LanguageText>
            </Button>
            <div className="relative">
              <Switch
                aria-label={t("subscription.annualPlan")}
                checked={isYearly}
                onCheckedChange={setIsYearly}
                className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted-foreground"
              />
            </div>
            <Button variant="ghost" onClick={() => setIsYearly(true)} aria-pressed={isYearly} className={`h-auto min-h-10 whitespace-normal px-3 py-2 text-sm font-medium ${isYearly ? 'text-foreground bg-muted' : 'text-muted-foreground'}`}>
              <LanguageText>{t('subscription.annualPlan')}</LanguageText>
            </Button>
          </div>
          <p className="mt-3 text-sm font-medium text-secondary"><LanguageText>{getCheaperText()}</LanguageText></p>
        </div>

        {/* Optimized Pricing Cards - removed heavy animations */}
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* Monthly Plan */}
          <div className={`landing-elevated relative flex flex-col bg-card border border-border text-card-foreground transition-colors duration-200 rounded-lg p-6 sm:p-8 ${!isYearly ? 'ring-2 ring-primary' : ''}`}>
            
            <div className="text-left pb-6 border-b border-border mb-6">
              <div className="bg-secondary/10 text-secondary px-2 py-1 rounded-full text-xs font-medium inline-block mb-2">
                <LanguageText>{t('subscription.trialIncluded')}</LanguageText>
              </div>
              <h3 className="text-xl font-bold text-foreground">
                <LanguageText>{t('subscription.monthlyPlan')}</LanguageText>
              </h3>
              <div className="mt-3">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="text-4xl font-bold text-foreground tabular-nums">{monthlyPrice}</span>
                   <span className="text-sm text-muted-foreground">/{t('subscription.monthlyDuration')}</span>
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-base line-through text-muted-foreground">{monthlyOriginalPrice}</span>
                  <span className="bg-secondary/10 text-secondary px-2 py-1 rounded text-xs font-medium">
                    <LanguageText>{t('subscription.discount50')}</LanguageText>
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-1 flex-col pt-0">
              <ul className="mb-6 flex-1 space-y-3">
                {features.map((feature, index) => (
                   <li key={index} className={`flex items-start gap-2 ${index === 9 ? 'border-t border-border pt-4' : ''}`}>
                    <Check className="mt-0.5 h-4 w-4 text-secondary flex-shrink-0" />
                     <span className="min-w-0 text-sm leading-relaxed text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => handleSubscribe('monthly')}
                disabled={loading !== null}
                className="w-full font-semibold transition-colors duration-200"
              >
                <LanguageText>
                  {loading === 'monthly' ? t('subscription.processing') : t('subscription.startFreeTrial')}
                </LanguageText>
              </Button>
              <p className="text-center text-xs text-muted-foreground mt-2">
                <LanguageText>{t('subscription.trialThenBilling')}</LanguageText>
              </p>
            </div>
          </div>

          {/* Yearly Plan */}
          <div className={`landing-surface landing-elevated relative flex flex-col border border-primary/25 text-card-foreground transition-colors duration-200 rounded-lg p-6 sm:p-8 ${isYearly ? 'ring-2 ring-primary' : ''}`}>
            
            <div className="text-left pb-6 border-b border-border mb-6">
              <div className="bg-secondary/10 text-secondary px-2 py-1 rounded-full text-xs font-medium inline-block mb-2">
                <LanguageText>{t('subscription.trialIncluded')}</LanguageText>
              </div>
              <h3 className="text-xl font-bold text-foreground">
                <LanguageText>{t('subscription.annualPlan')}</LanguageText>
              </h3>
              <div className="mt-3">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="text-4xl font-bold text-foreground tabular-nums">{yearlyPrice}</span>
                   <span className="text-sm text-muted-foreground">/{t('subscription.yearlyDuration')}</span>
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-base line-through text-muted-foreground">{yearlyOriginalPrice}</span>
                  <span className="bg-secondary/10 text-secondary px-2 py-1 rounded text-xs font-medium">
                    <LanguageText>{t('subscription.discount50')}</LanguageText>
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-1 flex-col pt-0">
              <ul className="space-y-3 mb-6 flex-1">
                {features.map((feature, index) => (
                   <li key={index} className={`flex items-start gap-2 ${index === 9 ? 'border-t border-border pt-4' : ''}`}>
                    <Check className="mt-0.5 h-4 w-4 text-secondary flex-shrink-0" />
                     <span className="min-w-0 text-sm leading-relaxed text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => handleSubscribe('yearly')}
                disabled={loading !== null}
                className="w-full font-semibold transition-colors duration-200"
              >
                <LanguageText>
                  {loading === 'yearly' ? t('subscription.processing') : t('subscription.startFreeTrial')}
                </LanguageText>
              </Button>
              <p className="text-center text-xs text-muted-foreground mt-2">
                <LanguageText>{t('subscription.trialThenBilling')}</LanguageText>
              </p>
            </div>
          </div>
        </div>

        <PricingFAQ />
        {/* Enhanced Additional Info */}
        <div className="text-center mt-8">
          <p className="text-muted-foreground text-sm">
            {!user && (
              <span>
                <LanguageText>{t('auth.noAccount')}</LanguageText>{' '}
                <Button variant="link"
                  onClick={() => navigate('/signup')}
                  className="underline hover:text-foreground transition-colors font-medium hover:drop-shadow-lg text-primary"
                >
                  <LanguageText>{t('auth.signUpCta')}</LanguageText>
                </Button>
              </span>
            )}
          </p>
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
