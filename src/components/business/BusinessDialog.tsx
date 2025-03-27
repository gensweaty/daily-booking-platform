
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { slugify } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface BusinessFormData {
  name: string;
  description: string;
  contact_phone: string;
  contact_address: string;
  contact_email: string;
  contact_website: string;
}

export interface BusinessData extends BusinessFormData {
  id: string;
  user_id: string;
  slug: string;
  created_at: string;
  updated_at: string;
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
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [coverPhoto, setCoverPhoto] = useState<File | null>(null);
  const [formData, setFormData] = useState<BusinessFormData>(
    existingBusiness || {
      name: "",
      description: "",
      contact_phone: "",
      contact_address: "",
      contact_email: "",
      contact_website: "",
    }
  );

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCoverPhoto(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      setIsSubmitting(true);

      // Generate a slug from the business name
      const slug = slugify(formData.name);

      let coverPhotoPath = existingBusiness?.cover_photo_path;

      // Handle file upload if a new cover photo is selected
      if (coverPhoto) {
        const fileExt = coverPhoto.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `business-photos/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('business-photos')
          .upload(filePath, coverPhoto);

        if (uploadError) {
          throw uploadError;
        }

        coverPhotoPath = filePath;
      }

      // Determine if we are creating or updating a business
      const isUpdate = !!existingBusiness;

      if (isUpdate) {
        // Update existing business
        const { data, error } = await supabase
          .from('businesses')
          .update({
            ...formData,
            slug,
            cover_photo_path: coverPhotoPath,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingBusiness.id)
          .select()
          .single();

        if (error) throw error;
        
        toast({
          title: t("business.updateSuccess"),
          description: t("business.businessUpdated"),
        });
        
        onBusinessCreated(data);
      } else {
        // Create new business
        const { data, error } = await supabase
          .from('businesses')
          .insert({
            ...formData,
            user_id: user.id,
            slug,
            cover_photo_path: coverPhotoPath,
          })
          .select()
          .single();

        if (error) throw error;

        toast({
          title: t("business.createSuccess"),
          description: t("business.businessCreated"),
        });
        
        onBusinessCreated(data);
      }

      onOpenChange(false);
    } catch (error: any) {
      console.error("Error saving business:", error);
      toast({
        title: t("business.error"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {existingBusiness
              ? t("business.editBusiness")
              : t("business.addBusiness")}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t("business.name")} *</Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder={t("business.namePlaceholder")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t("business.description")}</Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder={t("business.descriptionPlaceholder")}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact_phone">{t("business.contactPhone")}</Label>
            <Input
              id="contact_phone"
              name="contact_phone"
              value={formData.contact_phone}
              onChange={handleChange}
              placeholder={t("business.contactPhonePlaceholder")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact_address">{t("business.contactAddress")}</Label>
            <Textarea
              id="contact_address"
              name="contact_address"
              value={formData.contact_address}
              onChange={handleChange}
              placeholder={t("business.contactAddressPlaceholder")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact_email">{t("business.contactEmail")}</Label>
            <Input
              id="contact_email"
              name="contact_email"
              type="email"
              value={formData.contact_email}
              onChange={handleChange}
              placeholder={t("business.contactEmailPlaceholder")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact_website">{t("business.contactWebsite")}</Label>
            <Input
              id="contact_website"
              name="contact_website"
              value={formData.contact_website}
              onChange={handleChange}
              placeholder={t("business.contactWebsitePlaceholder")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cover_photo">{t("business.coverPhoto")}</Label>
            <Input
              id="cover_photo"
              name="cover_photo"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="cursor-pointer"
            />
            {existingBusiness?.cover_photo_path && !coverPhoto && (
              <p className="text-sm text-muted-foreground">
                {t("business.currentPhoto")}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {existingBusiness
                ? t("business.saveChanges")
                : t("business.createBusiness")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
