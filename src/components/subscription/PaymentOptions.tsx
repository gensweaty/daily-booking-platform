import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

type PaymentMethod = 'paypal' | 'card';

interface PaymentOptionsProps {
  selectedMethod: PaymentMethod;
  onMethodChange: (method: PaymentMethod) => void;
}

export const PaymentOptions = ({
  selectedMethod,
  onMethodChange
}: PaymentOptionsProps) => {
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
    </div>
  );
};