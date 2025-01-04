import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

type PaymentMethod = 'paypal' | 'card';

interface PaymentOptionsProps {
  selectedMethod: PaymentMethod;
  onMethodChange: (method: PaymentMethod) => void;
  planType: 'monthly' | 'yearly';
  onSuccess?: (subscriptionId: string) => void;
}

export const PaymentOptions = ({
  selectedMethod,
  onMethodChange,
  planType,
  onSuccess
}: PaymentOptionsProps) => {
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleCardPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    try {
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      const currentDate = new Date();
      const nextPeriodEnd = new Date(currentDate);
      
      if (planType === 'monthly') {
        nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1);
      } else {
        nextPeriodEnd.setFullYear(nextPeriodEnd.getFullYear() + 1);
      }

      // Update subscription status
      const { data: subscription, error: fetchError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('status', 'expired')
        .single();

      if (fetchError) throw fetchError;

      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({
          status: 'active',
          current_period_start: currentDate.toISOString(),
          current_period_end: nextPeriodEnd.toISOString(),
          plan_type: planType,
          last_payment_id: `card_${Date.now()}`
        })
        .eq('id', subscription.id);

      if (updateError) throw updateError;

      if (onSuccess) {
        onSuccess(`card_${Date.now()}`);
      }
    } catch (error) {
      console.error('Payment processing error:', error);
      toast({
        title: "Error",
        description: "There was an error processing your payment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <Label>Payment Method</Label>
      <RadioGroup
        value={selectedMethod}
        onValueChange={(value: PaymentMethod) => onMethodChange(value)}
        className="grid grid-cols-1 gap-4"
      >
        <div className="flex items-center space-x-2 border rounded-lg p-4">
          <RadioGroupItem value="paypal" id="paypal" />
          <Label htmlFor="paypal" className="flex-1">
            <div className="flex justify-between items-center">
              <span>PayPal</span>
              <span className="text-sm text-muted-foreground">Subscription via PayPal</span>
            </div>
          </Label>
        </div>
        <div className="flex items-center space-x-2 border rounded-lg p-4">
          <RadioGroupItem value="card" id="card" />
          <Label htmlFor="card" className="flex-1">
            <div className="flex justify-between items-center">
              <span>Credit/Debit Card</span>
              <span className="text-sm text-muted-foreground">Pay with card</span>
            </div>
          </Label>
        </div>
      </RadioGroup>

      {selectedMethod === 'card' && (
        <form onSubmit={handleCardPayment} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="cardNumber">Card Number</Label>
            <Input
              id="cardNumber"
              placeholder="1234 5678 9012 3456"
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="expiryDate">Expiry Date</Label>
              <Input
                id="expiryDate"
                placeholder="MM/YY"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cvv">CVV</Label>
              <Input
                id="cvv"
                placeholder="123"
                value={cvv}
                onChange={(e) => setCvv(e.target.value)}
                required
              />
            </div>
          </div>
          <Button 
            type="submit" 
            className="w-full"
            disabled={isProcessing}
          >
            {isProcessing ? 'Processing...' : 'Pay Now'}
          </Button>
        </form>
      )}
    </div>
  );
};