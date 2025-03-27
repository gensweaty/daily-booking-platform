
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useBusiness } from "@/hooks/useBusiness";
import { Business } from "@/lib/types/business";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/components/ui/use-toast";

interface BusinessFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const BusinessForm = ({ open, onOpenChange }: BusinessFormProps) => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const { createBusiness, uploadCoverPhoto } = useBusiness();
  
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactAddress, setContactAddress] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactWebsite, setContactWebsite] = useState("");
  const [coverPhoto, setCoverPhoto] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setCoverPhoto(event.target.files[0]);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!name.trim()) {
      toast({
        title: "Error",
        description: "Business name is required",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      // Create business first
      const businessData = {
        name,
        description,
        contact_phone: contactPhone,
        contact_address: contactAddress,
        contact_email: contactEmail,
        contact_website: contactWebsite,
        slug: "" // Will be generated in the hook
      };
      
      const newBusiness = await createBusiness(businessData);
      
      // If we have a cover photo, upload it
      if (coverPhoto && newBusiness) {
        const coverPhotoUrl = await uploadCoverPhoto(newBusiness.id, coverPhoto);
        
        // Update business with cover photo URL
        await fetch(`/api/business/${newBusiness.id}/update-photo`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ coverPhotoPath: coverPhotoUrl }),
        });
      }
      
      // Close the dialog
      onOpenChange(false);
      
      // Reset form
      setName("");
      setDescription("");
      setContactPhone("");
      setContactAddress("");
      setContactEmail("");
      setContactWebsite("");
      setCoverPhoto(null);
      
    } catch (error) {
      console.error("Error creating business:", error);
      toast({
        title: "Error",
        description: "Failed to create business. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{language === 'es' ? 'Añadir Negocio' : 'Add Business'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">{language === 'es' ? 'Nombre del Negocio' : 'Business Name'}*</Label>
            <Input 
              id="name" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              required
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="description">{language === 'es' ? 'Descripción' : 'Description'}</Label>
            <Textarea 
              id="description" 
              value={description} 
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="contactPhone">{language === 'es' ? 'Teléfono de Contacto' : 'Contact Phone'}</Label>
              <Input 
                id="contactPhone" 
                value={contactPhone} 
                onChange={(e) => setContactPhone(e.target.value)}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="contactEmail">{language === 'es' ? 'Email de Contacto' : 'Contact Email'}</Label>
              <Input 
                id="contactEmail"
                type="email" 
                value={contactEmail} 
                onChange={(e) => setContactEmail(e.target.value)}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="contactWebsite">{language === 'es' ? 'Sitio Web' : 'Website'}</Label>
              <Input 
                id="contactWebsite" 
                value={contactWebsite} 
                onChange={(e) => setContactWebsite(e.target.value)}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="coverPhoto">{language === 'es' ? 'Foto de Portada' : 'Cover Photo'}</Label>
              <Input 
                id="coverPhoto"
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
              />
            </div>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="contactAddress">{language === 'es' ? 'Dirección' : 'Address'}</Label>
            <Textarea 
              id="contactAddress" 
              value={contactAddress} 
              onChange={(e) => setContactAddress(e.target.value)}
              rows={2}
            />
          </div>
          
          <div className="flex justify-end gap-2 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {language === 'es' ? 'Cancelar' : 'Cancel'}
            </Button>
            <Button 
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? (language === 'es' ? 'Guardando...' : 'Saving...') : (language === 'es' ? 'Guardar' : 'Save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
