import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { subscriptionService } from "@/services/subscriptionService";
import { SubscriptionPlan } from "@/types/subscription";

export const SubscriptionPlans = () => {
  const navigate = useNavigate();

  const { data: plans, isLoading, error } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: subscriptionService.getPlans,
    retry: 2,
    meta: {
      errorMessage: "Failed to load subscription plans"
    }
  });

  const features = [
    "Full access to all features",
    "Priority support",
    "Unlimited storage",
    "Advanced analytics",
    "Custom integrations"
  ];

  const handleSelectPlan = (planType: string) => {
    navigate(`/signup?plan=${planType}`);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !plans) {
    return (
      <div className="text-center py-8">
        <p className="text-destructive">Unable to load subscription plans. Please try again later.</p>
      </div>
    );
  }

  return (
    <section className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Choose Your Plan</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Start with a 14-day free trial. No credit card required.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {plans.map((plan: SubscriptionPlan) => (
            <Card key={plan.id} className="relative overflow-hidden">
              {plan.type === 'yearly' && (
                <div className="absolute top-4 right-4">
                  <span className="bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full">
                    Best Value
                  </span>
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <div className="mt-4">
                  <span className="text-4xl font-bold">${plan.price}</span>
                  <span className="text-muted-foreground ml-2">
                    /{plan.type === 'monthly' ? 'month' : 'year'}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <Check className="w-5 h-5 text-primary" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full"
                  onClick={() => handleSelectPlan(plan.type)}
                >
                  Start Free Trial
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};