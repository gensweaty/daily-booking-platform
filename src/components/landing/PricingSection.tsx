
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
    <section className="py-20 bg-gradient-to-br from-primary/90 via-primary to-primary/80 text-white relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-blue-600/20" />
      <div 
        className="absolute top-0 left-0 w-full h-full opacity-30"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Ccircle cx='30' cy='30' r='4'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}
      />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            <LanguageText>{t('cta.title')}</LanguageText>
          </h2>
          <p className="text-xl opacity-90 mb-8 max-w-2xl mx-auto">
            <LanguageText>{t('cta.subtitle')}</LanguageText>
          </p>
          
          {/* Pricing Toggle */}
          <div className="flex items-center justify-center gap-4 mb-12">
            <span className={`text-lg font-medium ${!isYearly ? 'text-white' : 'text-white/70'}`}>
              <LanguageText>{t('subscription.monthlyPlan')}</LanguageText>
            </span>
            <Switch
              checked={isYearly}
              onCheckedChange={setIsYearly}
              className="data-[state=checked]:bg-white data-[state=unchecked]:bg-white/30"
            />
            <span className={`text-lg font-medium ${isYearly ? 'text-white' : 'text-white/70'}`}>
              <LanguageText>{t('subscription.annualPlan')}</LanguageText>
            </span>
            {isYearly && (
              <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-medium ml-2">
                <LanguageText>{t('subscription.discount50')}</LanguageText>
              </span>
            )}
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Monthly Plan */}
          <Card className={`relative bg-white/10 backdrop-blur-sm border-white/20 text-white transition-all duration-300 hover:scale-105 hover:bg-white/15 ${!isYearly ? 'ring-2 ring-white/50' : ''}`}>
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-2xl font-bold">
                <LanguageText>{t('subscription.monthlyPlan')}</LanguageText>
              </CardTitle>
              <div className="mt-4">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-4xl font-bold">{monthlyPrice}</span>
                  <span className="text-lg opacity-70">/{t('subscription.monthlyDuration').split(' ')[0]}</span>
                </div>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <span className="text-lg line-through opacity-50">{monthlyOriginalPrice}</span>
                  <span className="bg-green-500 text-white px-2 py-1 rounded text-sm font-medium">
                    <LanguageText>{t('subscription.discount50')}</LanguageText>
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="space-y-3 mb-6">
                {features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-green-400 flex-shrink-0" />
                    <span><LanguageText>{feature}</LanguageText></span>
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => handleSubscribe('monthly')}
                disabled={loading !== null}
                className="w-full bg-white text-primary hover:bg-white/90 font-semibold py-3"
              >
                <LanguageText>
                  {loading === 'monthly' ? t('subscription.processing') : t('subscription.subscribeNow')}
                </LanguageText>
              </Button>
            </CardContent>
          </Card>

          {/* Yearly Plan */}
          <Card className={`relative bg-white/10 backdrop-blur-sm border-white/20 text-white transition-all duration-300 hover:scale-105 hover:bg-white/15 ${isYearly ? 'ring-2 ring-white/50' : ''}`}>
            {isYearly && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <div className="bg-yellow-500 text-primary px-4 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                  <Star className="h-4 w-4" />
                  <LanguageText>{t('subscription.additionalSavings')}</LanguageText>
                </div>
              </div>
            )}
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-2xl font-bold">
                <LanguageText>{t('subscription.annualPlan')}</LanguageText>
              </CardTitle>
              <div className="mt-4">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-4xl font-bold">{yearlyPrice}</span>
                  <span className="text-lg opacity-70">/{t('subscription.yearlyDuration').split(' ')[0]}</span>
                </div>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <span className="text-lg line-through opacity-50">{yearlyOriginalPrice}</span>
                  <span className="bg-green-500 text-white px-2 py-1 rounded text-sm font-medium">
                    58% <LanguageText>{t('subscription.additionalSavings')}</LanguageText>
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="space-y-3 mb-6">
                {features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-green-400 flex-shrink-0" />
                    <span><LanguageText>{feature}</LanguageText></span>
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => handleSubscribe('yearly')}
                disabled={loading !== null}
                className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-primary hover:from-yellow-400 hover:to-orange-400 font-semibold py-3"
              >
                <LanguageText>
                  {loading === 'yearly' ? t('subscription.processing') : t('subscription.subscribeNow')}
                </LanguageText>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Additional Info */}
        <div className="text-center mt-12">
          <p className="text-white/80 text-sm">
            {!user && (
              <span>
                <LanguageText>{t('auth.noAccount')}</LanguageText>{' '}
                <button 
                  onClick={() => navigate('/signup')}
                  className="underline hover:text-white transition-colors"
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
