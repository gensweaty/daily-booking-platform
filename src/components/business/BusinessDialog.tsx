
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useBusiness } from "@/hooks/useBusiness";
import { Business, BusinessFormData } from "@/lib/types/business";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/components/ui/use-toast";

interface BusinessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  business?: Business | null;
}

export const BusinessDialog = ({ open, onOpenChange, business }: BusinessDialogProps) => {
  const { t } = useLanguage();
  const { createBusiness, updateBusiness, isSubmitting } = useBusiness();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState<BusinessFormData>({
    name: business?.name || "",
    description: business?.description || "",
    contact_phone: business?.contact_phone || "",
    contact_address: business?.contact_address || "",
    contact_email: business?.contact_email || "",
    contact_website: business?.contact_website || "",
  });
  
  const [coverPhoto, setCoverPhoto] = useState<File | null>(null);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCoverPhoto(e.target.files[0]);
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name) {
      toast({
        title: "Error",
        description: "Business name is required",
        variant: "destructive",
      });
      return;
    }
    
    try {
      if (business) {
        await updateBusiness({
          id: business.id,
          data: {
            ...formData,
            cover_photo: coverPhoto || undefined,
          },
        });
      } else {
        await createBusiness({
          ...formData,
          cover_photo: coverPhoto || undefined,
        });
      }
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving business:", error);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {business ? "Edit Business" : "Add Business"}
          </DialogTitle>
          <DialogDescription>
            {business 
              ? "Update your business information below."
              : "Fill out the form below to add your business."}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Business Name *</Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Enter business name"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Business Description</Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Enter business description"
              rows={3}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="contact_phone">Contact Phone</Label>
            <Input
              id="contact_phone"
              name="contact_phone"
              value={formData.contact_phone}
              onChange={handleInputChange}
              placeholder="Enter contact phone"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="contact_address">Contact Address</Label>
            <Input
              id="contact_address"
              name="contact_address"
              value={formData.contact_address}
              onChange={handleInputChange}
              placeholder="Enter contact address"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="contact_email">Contact Email</Label>
            <Input
              id="contact_email"
              name="contact_email"
              type="email"
              value={formData.contact_email}
              onChange={handleInputChange}
              placeholder="Enter contact email"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="contact_website">Contact Website</Label>
            <Input
              id="contact_website"
              name="contact_website"
              value={formData.contact_website}
              onChange={handleInputChange}
              placeholder="Enter contact website"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="cover_photo">Cover Photo</Label>
            <Input
              id="cover_photo"
              name="cover_photo"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
            />
            {business?.cover_photo_path && !coverPhoto && (
              <p className="text-sm text-muted-foreground">
                Current cover photo will be kept unless you select a new one.
              </p>
            )}
          </div>
          
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : (business ? "Update" : "Create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
