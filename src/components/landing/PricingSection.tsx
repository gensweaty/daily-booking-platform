
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Check, Star } from "lucide-react";
import { useLanguage, getCurrencySymbol } from "@/contexts/LanguageContext";
import { LanguageText } from "@/components/shared/LanguageText";
import { useAuth } from "@/contexts/AuthContext";
import { createCheckoutSession } from "@/utils/stripeUtils";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

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

  const currencySymbol = getCurrencySymbol(language);

  const monthlyPrice = language === 'ka' ? '₾15' : language === 'es' ? '$15' : '$15';
  const yearlyPrice = language === 'ka' ? '₾150' : language === 'es' ? '$150' : '$150';
  const monthlyOriginalPrice = language === 'ka' ? '₾30' : language === 'es' ? '$30' : '$30';
  const yearlyOriginalPrice = language === 'ka' ? '₾360' : language === 'es' ? '$360' : '$360';

  const features = [
    t('booking.title'),
    t('tasks.title'),
    t('crm.title'),
    t('analytics.title'),
    t('website.title')
  ];

  return (
    <section className="py-20 bg-gradient-to-br from-slate-900 via-primary/20 to-slate-800 text-white relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-blue-600/10" />
      <div 
        className="absolute top-0 left-0 w-full h-full opacity-20"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='4'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}
      />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">
            <LanguageText>{t('cta.title')}</LanguageText>
          </h2>
          <p className="text-xl text-gray-200 mb-4 max-w-2xl mx-auto">
            <LanguageText>{t('cta.subtitle')}</LanguageText>
          </p>
          <div className="bg-green-500/20 text-green-300 px-4 py-2 rounded-full text-lg font-semibold inline-block mb-8">
            <LanguageText>{t('subscription.freeTrial')}</LanguageText>
          </div>
          
          {/* Pricing Toggle */}
          <div className="flex items-center justify-center gap-4 mb-12">
            <span className={`text-lg font-medium transition-colors ${!isYearly ? 'text-white' : 'text-gray-300'}`}>
              <LanguageText>{t('subscription.monthlyPlan')}</LanguageText>
            </span>
            <div className="relative">
              <Switch
                checked={isYearly}
                onCheckedChange={setIsYearly}
                className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-gray-600 border-2 border-gray-400"
              />
            </div>
            <span className={`text-lg font-medium transition-colors ${isYearly ? 'text-white' : 'text-gray-300'}`}>
              <LanguageText>{t('subscription.annualPlan')}</LanguageText>
            </span>
            {isYearly && (
              <span className="bg-yellow-500 text-black px-3 py-1 rounded-full text-sm font-bold ml-2">
                <LanguageText>{t('subscription.discount50')}</LanguageText>
              </span>
            )}
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Monthly Plan */}
          <Card className={`relative bg-slate-800/80 backdrop-blur-sm border-slate-600 text-white transition-all duration-300 hover:scale-105 hover:bg-slate-700/80 shadow-2xl ${!isYearly ? 'ring-2 ring-primary shadow-primary/25' : ''}`}>
            <CardHeader className="text-center pb-4">
              <div className="bg-green-500/20 text-green-300 px-3 py-1 rounded-full text-sm font-medium inline-block mb-2">
                <LanguageText>{t('subscription.trialIncluded')}</LanguageText>
              </div>
              <CardTitle className="text-2xl font-bold text-white">
                <LanguageText>{t('subscription.monthlyPlan')}</LanguageText>
              </CardTitle>
              <div className="mt-4">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-4xl font-bold text-white">{monthlyPrice}</span>
                  <span className="text-lg text-gray-300">/{t('subscription.monthlyDuration')}</span>
                </div>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <span className="text-lg line-through text-gray-400">{monthlyOriginalPrice}</span>
                  <span className="bg-green-500 text-white px-2 py-1 rounded text-sm font-medium">
                    <LanguageText>{t('subscription.discount50')}</LanguageText>
                  </span>
                </div>
                <p className="text-sm text-gray-300 mt-2">
                  <LanguageText>{t('subscription.freeTrialDescription')}</LanguageText>
                </p>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="space-y-3 mb-6">
                {features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-green-400 flex-shrink-0" />
                    <span className="text-gray-200"><LanguageText>{feature}</LanguageText></span>
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => handleSubscribe('monthly')}
                disabled={loading !== null}
                className="w-full bg-white text-slate-900 hover:bg-gray-100 font-semibold py-3 transition-colors"
              >
                <LanguageText>
                  {loading === 'monthly' ? t('subscription.processing') : t('subscription.startFreeTrial')}
                </LanguageText>
              </Button>
              <p className="text-center text-sm text-gray-400 mt-2">
                <LanguageText translateParams={{ price: monthlyPrice, period: t('subscription.monthlyDuration') }}>
                  {t('subscription.trialThenBilling')}
                </LanguageText>
              </p>
            </CardContent>
          </Card>

          {/* Yearly Plan */}
          <Card className={`relative bg-slate-800/80 backdrop-blur-sm border-slate-600 text-white transition-all duration-300 hover:scale-105 hover:bg-slate-700/80 shadow-2xl ${isYearly ? 'ring-2 ring-yellow-500 shadow-yellow-500/25' : ''}`}>
            {isYearly && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <div className="bg-yellow-500 text-black px-4 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                  <Star className="h-4 w-4" />
                  <LanguageText>{t('subscription.additionalSavings')}</LanguageText>
                </div>
              </div>
            )}
            <CardHeader className="text-center pb-4">
              <div className="bg-green-500/20 text-green-300 px-3 py-1 rounded-full text-sm font-medium inline-block mb-2">
                <LanguageText>{t('subscription.trialIncluded')}</LanguageText>
              </div>
              <CardTitle className="text-2xl font-bold text-white">
                <LanguageText>{t('subscription.annualPlan')}</LanguageText>
              </CardTitle>
              <div className="mt-4">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-4xl font-bold text-white">{yearlyPrice}</span>
                  <span className="text-lg text-gray-300">/{t('subscription.yearlyDuration')}</span>
                </div>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <span className="text-lg line-through text-gray-400">{yearlyOriginalPrice}</span>
                  <span className="bg-green-500 text-white px-2 py-1 rounded text-sm font-medium">
                    58% <LanguageText>{t('subscription.additionalSavings')}</LanguageText>
                  </span>
                </div>
                <p className="text-sm text-gray-300 mt-2">
                  <LanguageText>{t('subscription.freeTrialDescription')}</LanguageText>
                </p>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="space-y-3 mb-6">
                {features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-green-400 flex-shrink-0" />
                    <span className="text-gray-200"><LanguageText>{feature}</LanguageText></span>
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => handleSubscribe('yearly')}
                disabled={loading !== null}
                className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-black hover:from-yellow-400 hover:to-orange-400 font-semibold py-3 transition-all"
              >
                <LanguageText>
                  {loading === 'yearly' ? t('subscription.processing') : t('subscription.startFreeTrial')}
                </LanguageText>
              </Button>
              <p className="text-center text-sm text-gray-400 mt-2">
                <LanguageText translateParams={{ price: yearlyPrice, period: t('subscription.yearlyDuration') }}>
                  {t('subscription.trialThenBilling')}
                </LanguageText>
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Additional Info */}
        <div className="text-center mt-12">
          <p className="text-gray-300 text-sm">
            {!user && (
              <span>
                <LanguageText>{t('auth.noAccount')}</LanguageText>{' '}
                <button 
                  onClick={() => navigate('/signup')}
                  className="underline hover:text-white transition-colors font-medium"
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
