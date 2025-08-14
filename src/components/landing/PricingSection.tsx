import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Check, Star } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "@/components/shared/LanguageText";
import { useAuth } from "@/contexts/AuthContext";
import { createCheckoutSession } from "@/utils/stripeUtils";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

const PricingSection = () => {
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
    <section className="py-16 bg-gradient-to-br from-slate-900 via-primary/20 to-slate-800 text-white relative overflow-hidden">
      {/* Reduced Background Elements */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-blue-600/5 animate-gradient-shift" style={{backgroundSize: '400% 400%'}} />
      <div 
        className="absolute top-0 left-0 w-full h-full opacity-10"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Ccircle cx='30' cy='30' r='4'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}
      />
      
      {/* Reduced Floating Shapes */}
      <div className="absolute top-10 left-10 w-16 h-16 bg-gradient-to-br from-primary/10 to-accent/10 rounded-full blur-xl animate-ultra-gentle-float" />
      <div className="absolute bottom-20 right-20 w-12 h-12 bg-gradient-to-br from-accent/10 to-primary/10 rounded-full blur-xl animate-ultra-gentle-float" style={{animationDelay: '6s'}} />
      <div className="absolute top-1/2 left-1/4 w-8 h-8 bg-gradient-to-br from-primary/5 to-accent/5 rounded-full blur-lg animate-ultra-gentle-float" style={{animationDelay: '12s'}} />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white enhanced-gradient-text drop-shadow-lg">
            <LanguageText>{t('cta.title')}</LanguageText>
          </h2>
          <p className="text-lg text-gray-200 mb-6 max-w-2xl mx-auto drop-shadow-sm">
            <LanguageText>{t('cta.subtitle')}</LanguageText>
          </p>
          
          {/* Free Trial Badge on its own line */}
          <div className="mb-4">
            <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-300 px-4 py-2 rounded-full text-base font-semibold inline-block glass-morphism">
              <LanguageText>{t('subscription.freeTrial')}</LanguageText>
            </div>
          </div>
          
          {/* Pricing Toggle on separate line */}
          <div className="flex items-center justify-center gap-3 mb-8 glass-morphism rounded-full p-2 inline-flex">
            <span className={`text-base font-medium transition-all duration-300 px-3 py-1 rounded-full ${!isYearly ? 'text-white bg-white/10' : 'text-gray-300'}`}>
              <LanguageText>{t('subscription.monthlyPlan')}</LanguageText>
            </span>
            <div className="relative">
              <Switch
                checked={isYearly}
                onCheckedChange={setIsYearly}
                className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-primary data-[state=checked]:to-accent data-[state=unchecked]:bg-gray-600 border-2 border-gray-400 transition-all duration-300"
              />
            </div>
            <span className={`text-base font-medium transition-all duration-300 px-3 py-1 rounded-full flex items-center gap-2 ${isYearly ? 'text-white bg-white/10' : 'text-gray-300'}`}>
              <LanguageText>{t('subscription.annualPlan')}</LanguageText>
              {isYearly && (
                <span className="bg-gradient-to-r from-green-500 to-emerald-500 text-black px-2 py-1 rounded-full text-xs font-bold">
                  {getCheaperText()}
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Enhanced Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* Monthly Plan */}
          <div className={`relative enhanced-card bg-slate-800/80 backdrop-blur-sm border-slate-600 text-white transition-all duration-300 hover:scale-105 hover:bg-slate-700/80 shadow-2xl rounded-xl p-6 transform-3d ${!isYearly ? 'ring-2 ring-primary shadow-primary/25' : ''}`}>
            {/* Floating decorative elements */}
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-accent/40 rounded-full animate-ultra-gentle-float blur-sm" />
            <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-primary/40 rounded-full animate-ultra-gentle-float blur-sm" style={{animationDelay: '9s'}} />
            
            <div className="text-center pb-3">
              <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-300 px-2 py-1 rounded-full text-xs font-medium inline-block mb-2 animate-ultra-subtle-shimmer" style={{backgroundSize: '200% 100%'}}>
                <LanguageText>{t('subscription.trialIncluded')}</LanguageText>
              </div>
              <h3 className="text-xl font-bold text-white enhanced-gradient-text">
                <LanguageText>{t('subscription.monthlyPlan')}</LanguageText>
              </h3>
              <div className="mt-3">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-3xl font-bold text-white drop-shadow-lg">{monthlyPrice}</span>
                  <span className="text-base text-gray-300">/{t('subscription.monthlyDuration')}</span>
                </div>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <span className="text-base line-through text-gray-400">{monthlyOriginalPrice}</span>
                  <span className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-2 py-1 rounded text-xs font-medium">
                    <LanguageText>{t('subscription.discount50')}</LanguageText>
                  </span>
                </div>
              </div>
            </div>
            <div className="pt-0">
              <ul className="space-y-2 mb-4">
                {features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-2 stagger-child" style={{animationDelay: `${index * 50}ms`}}>
                    <Check className="h-4 w-4 text-green-400 flex-shrink-0 drop-shadow-sm" />
                    <span className="text-gray-200 text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => handleSubscribe('monthly')}
                disabled={loading !== null}
                className="w-full bg-gradient-to-r from-white/90 to-gray-100/90 text-slate-900 hover:from-gray-100/90 hover:to-white/90 font-semibold py-2 transition-all duration-1500 text-sm ripple-container hover:scale-101 animate-ultra-subtle-shimmer" 
                style={{backgroundSize: '200% 100%'}}
                onMouseDown={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const ripple = document.createElement('span');
                  ripple.classList.add('ripple-effect');
                  ripple.style.left = `${e.clientX - rect.left}px`;
                  ripple.style.top = `${e.clientY - rect.top}px`;
                  e.currentTarget.appendChild(ripple);
                  setTimeout(() => ripple.remove(), 600);
                }}
              >
                <LanguageText>
                  {loading === 'monthly' ? t('subscription.processing') : t('subscription.startFreeTrial')}
                </LanguageText>
              </Button>
              <p className="text-center text-xs text-gray-400 mt-2">
                <LanguageText>{t('subscription.trialThenBilling')}</LanguageText>
              </p>
            </div>
          </div>

          {/* Yearly Plan */}
          <div className={`relative enhanced-card bg-slate-800/80 backdrop-blur-sm border-slate-600 text-white transition-all duration-300 hover:scale-105 hover:bg-slate-700/80 shadow-2xl rounded-xl p-6 transform-3d hover-tilt ${isYearly ? 'ring-2 ring-yellow-500 shadow-yellow-500/25' : ''}`}>
            {/* Floating decorative elements */}
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400/40 rounded-full animate-ultra-gentle-float blur-sm" />
            <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-orange-400/40 rounded-full animate-ultra-gentle-float blur-sm" style={{animationDelay: '6s'}} />
            
            <div className="text-center pb-3">
              <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-300 px-2 py-1 rounded-full text-xs font-medium inline-block mb-2 animate-ultra-subtle-shimmer" style={{backgroundSize: '200% 100%'}}>
                <LanguageText>{t('subscription.trialIncluded')}</LanguageText>
              </div>
              <h3 className="text-xl font-bold text-white enhanced-gradient-text">
                <LanguageText>{t('subscription.annualPlan')}</LanguageText>
              </h3>
              <div className="mt-3">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-3xl font-bold text-white drop-shadow-lg">{yearlyPrice}</span>
                  <span className="text-base text-gray-300">/{t('subscription.yearlyDuration')}</span>
                </div>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <span className="text-base line-through text-gray-400">{yearlyOriginalPrice}</span>
                  <span className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-2 py-1 rounded text-xs font-medium">
                    <LanguageText>{t('subscription.discount50')}</LanguageText>
                  </span>
                </div>
              </div>
            </div>
            <div className="pt-0">
              <ul className="space-y-2 mb-4">
                {features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-2 stagger-child" style={{animationDelay: `${index * 50}ms`}}>
                    <Check className="h-4 w-4 text-green-400 flex-shrink-0 drop-shadow-sm" />
                    <span className="text-gray-200 text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => handleSubscribe('yearly')}
                disabled={loading !== null}
                className="w-full bg-gradient-to-r from-yellow-500/90 to-orange-500/90 text-black hover:from-yellow-400/90 hover:to-orange-400/90 font-semibold py-2 transition-all duration-1500 text-sm ripple-container hover:scale-101 animate-ultra-subtle-shimmer"
                style={{backgroundSize: '200% 100%'}}
                onMouseDown={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const ripple = document.createElement('span');
                  ripple.classList.add('ripple-effect');
                  ripple.style.left = `${e.clientX - rect.left}px`;
                  ripple.style.top = `${e.clientY - rect.top}px`;
                  e.currentTarget.appendChild(ripple);
                  setTimeout(() => ripple.remove(), 600);
                }}
              >
                <LanguageText>
                  {loading === 'yearly' ? t('subscription.processing') : t('subscription.startFreeTrial')}
                </LanguageText>
              </Button>
              <p className="text-center text-xs text-gray-400 mt-2">
                <LanguageText>{t('subscription.trialThenBilling')}</LanguageText>
              </p>
            </div>
          </div>
        </div>

        {/* Enhanced Additional Info */}
        <div className="text-center mt-8">
          <p className="text-gray-300 text-sm drop-shadow-sm">
            {!user && (
              <span>
                <LanguageText>{t('auth.noAccount')}</LanguageText>{' '}
                <button 
                  onClick={() => navigate('/signup')}
                  className="underline hover:text-white transition-colors font-medium hover:drop-shadow-lg enhanced-gradient-text"
                >
                  <LanguageText>{t('auth.signUpCta')}</LanguageText>
                </button>
              </span>
            )}
          </p>
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
