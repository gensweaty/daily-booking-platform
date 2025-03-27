
import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { slugify } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export interface BusinessData {
  id: string;
  name: string;
  description?: string;
  contact_phone?: string;
  contact_address?: string;
  contact_email?: string;
  contact_website?: string;
  slug: string;
  cover_photo_path?: string;
}

interface BusinessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBusinessCreated: (business: BusinessData) => void;
  existingBusiness?: BusinessData;
}

export const BusinessDialog = ({
  open,
  onOpenChange,
  onBusinessCreated,
  existingBusiness,
}: BusinessDialogProps) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactAddress, setContactAddress] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactWebsite, setContactWebsite] = useState("");
  const [coverPhoto, setCoverPhoto] = useState<File | null>(null);
  const [coverPhotoPreview, setCoverPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (open && existingBusiness) {
      setName(existingBusiness.name || "");
      setDescription(existingBusiness.description || "");
      setContactPhone(existingBusiness.contact_phone || "");
      setContactAddress(existingBusiness.contact_address || "");
      setContactEmail(existingBusiness.contact_email || "");
      setContactWebsite(existingBusiness.contact_website || "");
      
      // If there's an existing cover photo, fetch and display it
      if (existingBusiness.cover_photo_path) {
        const fetchCoverPhoto = async () => {
          try {
            const { data, error } = await supabase.storage
              .from('business-photos')
              .getPublicUrl(existingBusiness.cover_photo_path || '');
            
            if (error) throw error;
            setCoverPhotoPreview(data.publicUrl);
          } catch (error) {
            console.error("Error fetching cover photo:", error);
          }
        };
        
        fetchCoverPhoto();
      } else {
        setCoverPhotoPreview(null);
      }
    } else if (open) {
      // Reset form when opening for a new business
      setName("");
      setDescription("");
      setContactPhone("");
      setContactAddress("");
      setContactEmail("");
      setContactWebsite("");
      setCoverPhoto(null);
      setCoverPhotoPreview(null);
    }
  }, [open, existingBusiness]);

  const handleCoverPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setCoverPhoto(file);
      
      // Create a preview
      const reader = new FileReader();
      reader.onload = () => {
        setCoverPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !name) return;
    
    try {
      setIsSubmitting(true);
      
      // Generate a unique slug from the business name
      const initialSlug = slugify(name);
      let slug = initialSlug;
      let suffixNum = 0;
      
      // Check if slug exists (for new businesses only)
      if (!existingBusiness) {
        let slugExists = true;
        while (slugExists) {
          const { data, error } = await supabase
            .from('businesses')
            .select('id')
            .eq('slug', slug)
            .maybeSingle();
          
          if (error) throw error;
          
          if (data) {
            // Slug exists, add a suffix
            suffixNum++;
            slug = `${initialSlug}-${suffixNum}`;
          } else {
            slugExists = false;
          }
        }
      }
      
      let coverPhotoPath = existingBusiness?.cover_photo_path || null;
      
      // Upload cover photo if provided
      if (coverPhoto) {
        const filePath = `${user.id}/${Date.now()}-${coverPhoto.name}`;
        
        const { error: uploadError } = await supabase.storage
          .from('business-photos')
          .upload(filePath, coverPhoto);
        
        if (uploadError) throw uploadError;
        coverPhotoPath = filePath;
      }
      
      // Prepare business data
      const businessData = {
        name,
        description,
        contact_phone: contactPhone,
        contact_address: contactAddress,
        contact_email: contactEmail,
        contact_website: contactWebsite,
        slug: existingBusiness?.slug || slug,
        cover_photo_path: coverPhotoPath,
        user_id: user.id,
      };
      
      let result;
      
      if (existingBusiness) {
        // Update existing business
        const { data, error } = await supabase
          .from('businesses')
          .update(businessData)
          .eq('id', existingBusiness.id)
          .select('*')
          .single();
        
        if (error) throw error;
        result = data;
      } else {
        // Insert new business
        const { data, error } = await supabase
          .from('businesses')
          .insert(businessData)
          .select('*')
          .single();
        
        if (error) throw error;
        result = data;
      }
      
      // Call the callback with the new/updated business
      onBusinessCreated(result);
      
      // Close the dialog
      onOpenChange(false);
      
      // Show success message
      toast({
        title: t("common.success"),
        description: existingBusiness 
          ? "Business updated successfully" 
          : "Business created successfully",
      });
    } catch (error: any) {
      console.error('Error saving business:', error);
      toast({
        title: t("common.error"),
        description: error.message || "Failed to save business",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {existingBusiness ? t("common.edit") + " " + existingBusiness.name : t("business.addBusiness")}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <div className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-base font-semibold">
                {t("business.businessDetails")}
              </Label>
              <div className="mt-3 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t("business.businessName")} *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="e.g. My Awesome Business"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">{t("business.businessDescription")}</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    placeholder="Describe your business..."
                  />
                </div>
              </div>
            </div>
            
            <div className="pt-4">
              <Label htmlFor="contactPhone" className="text-base font-semibold">
                {t("business.contactInformation")}
              </Label>
              <div className="mt-3 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="contactPhone">{t("business.contactPhone")}</Label>
                  <Input
                    id="contactPhone"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="contactAddress">{t("business.contactAddress")}</Label>
                  <Textarea
                    id="contactAddress"
                    value={contactAddress}
                    onChange={(e) => setContactAddress(e.target.value)}
                    rows={2}
                    placeholder="123 Business St, City, State, ZIP"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="contactEmail">{t("business.contactEmail")}</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="contact@mybusiness.com"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="contactWebsite">{t("business.contactWebsite")}</Label>
                  <Input
                    id="contactWebsite"
                    value={contactWebsite}
                    onChange={(e) => setContactWebsite(e.target.value)}
                    placeholder="www.mybusiness.com"
                  />
                </div>
              </div>
            </div>
            
            <div className="pt-4">
              <Label htmlFor="coverPhoto" className="text-base font-semibold">
                {t("business.coverPhoto")}
              </Label>
              <div className="mt-3 space-y-4">
                {coverPhotoPreview && (
                  <div className="mt-2">
                    <img
                      src={coverPhotoPreview}
                      alt="Cover preview"
                      className="w-full max-h-48 object-cover rounded-md"
                    />
                  </div>
                )}
                
                <Input
                  id="coverPhoto"
                  type="file"
                  accept="image/*"
                  onChange={handleCoverPhotoChange}
                  className="cursor-pointer"
                />
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting || !name}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("common.loading")}
                </>
              ) : existingBusiness ? (
                t("common.save")
              ) : (
                t("common.create")
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
