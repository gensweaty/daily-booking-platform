import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CustomerDialogFields } from "./CustomerDialogFields";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface CustomerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  customerId?: string;
}

export const CustomerDialog = ({ isOpen, onClose, customerId }: CustomerDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [customerData, setCustomerData] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchCustomer = async () => {
      if (!customerId) return;
      
      try {
        setLoading(true);
        console.log('Fetching customer with ID:', customerId);
        
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .eq('id', customerId)
          .maybeSingle();
          
        if (error) {
          console.error('Error fetching customer:', error);
          toast({
            title: "Error",
            description: "Failed to fetch customer details",
            variant: "destructive",
          });
          return;
        }
        
        console.log('Fetched customer data:', data);
        setCustomerData(data || null);
      } catch (error) {
        console.error('Unexpected error:', error);
        toast({
          title: "Error",
          description: "An unexpected error occurred",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (isOpen && customerId) {
      fetchCustomer();
    }
  }, [customerId, isOpen, toast]);

  const handleSave = async (formData: any) => {
    try {
      setLoading(true);
      console.log('Saving customer data:', formData);

      const { error } = customerId
        ? await supabase
            .from('customers')
            .update(formData)
            .eq('id', customerId)
        : await supabase
            .from('customers')
            .insert([formData]);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Customer ${customerId ? 'updated' : 'created'} successfully`,
      });
      
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      onClose();
    } catch (error: any) {
      console.error('Error saving customer:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save customer",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => !loading && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {customerId ? 'Edit Customer' : 'New Customer'}
          </DialogTitle>
        </DialogHeader>
        
        <CustomerDialogFields
          initialData={customerData}
          onSubmit={handleSave}
          isLoading={loading}
        />
      </DialogContent>
    </Dialog>
  );
};