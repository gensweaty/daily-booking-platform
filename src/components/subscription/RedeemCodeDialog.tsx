
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "@/components/shared/LanguageText";
import { redeemCode } from "@/lib/subscription";

interface RedeemCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const RedeemCodeDialog = ({ 
  open, 
  onOpenChange,
  onSuccess
}: RedeemCodeDialogProps) => {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { t } = useLanguage();

  const handleRedeem = async () => {
    if (!code.trim()) {
      toast({
        title: "Error",
        description: "Please enter a redeem code",
        variant: "destructive",
      });
      return;
    }
    
    console.log('Attempting to redeem code:', code.trim());
    setLoading(true);
    
    try {
      const result = await redeemCode(code.trim());
      console.log('Redeem result:', result);
      
      if (result.success) {
        toast({
          title: "Success",
          description: result.message,
        });
        setCode("");
        onOpenChange(false);
        onSuccess();
      } else {
        toast({
          title: "Error",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error redeeming code:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-[400px] p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-center text-xl font-bold">
            <LanguageText>Redeem Promo Code</LanguageText>
          </DialogTitle>
        </DialogHeader>
        <div className="mt-4 space-y-4">
          <p className="text-center text-sm text-muted-foreground">
            <LanguageText>Enter your promo code to get unlimited access</LanguageText>
          </p>
          
          <div className="space-y-2">
            <Input
              placeholder="Enter promo code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={loading}
              onKeyPress={(e) => e.key === 'Enter' && handleRedeem()}
            />
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="flex-1"
            >
              <LanguageText>Cancel</LanguageText>
            </Button>
            <Button
              onClick={handleRedeem}
              disabled={loading || !code.trim()}
              className="flex-1"
            >
              <LanguageText>{loading ? 'Redeeming...' : 'Redeem'}</LanguageText>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
