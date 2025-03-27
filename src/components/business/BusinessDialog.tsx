
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Business, BusinessData } from '@/lib/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { Upload } from 'lucide-react';

interface BusinessDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (business: Business) => void;
  business?: Business;
}

export const BusinessDialog: React.FC<BusinessDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  business,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [formData, setFormData] = useState<Partial<Business>>({
    name: '',
    description: '',
    contact_phone: '',
    contact_address: '',
    contact_email: '',
    contact_website: '',
    cover_photo: '',
    user_id: user?.id,
  });

  useEffect(() => {
    if (business) {
      setFormData({
        ...business,
      });
    } else {
      setFormData({
        name: '',
        description: '',
        contact_phone: '',
        contact_address: '',
        contact_email: '',
        contact_website: '',
        cover_photo: '',
        user_id: user?.id,
      });
    }
  }, [business, user?.id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      let coverPhotoPath = formData.cover_photo || '';

      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('business-images')
          .upload(filePath, file);

        if (uploadError) {
          throw uploadError;
        }

        coverPhotoPath = filePath;
      }

      const newBusiness: Partial<Business> = {
        ...formData,
        cover_photo: coverPhotoPath,
        user_id: user?.id,
      };

      onSave(newBusiness as Business);
      setFile(null);
    } catch (error) {
      console.error('Error saving business:', error);
      toast({
        title: 'Error',
        description: 'Failed to save business information',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const imageUrl = file 
    ? URL.createObjectURL(file) 
    : (formData.cover_photo 
      ? supabase.storage.from('business-images').getPublicUrl(formData.cover_photo).data.publicUrl 
      : '/placeholder.svg');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] bg-background">
        <DialogHeader>
          <DialogTitle>{business ? t('business.businessDetails') : t('business.addBusiness')}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-1 gap-4">
            <div className="mb-4">
              <Label htmlFor="cover_photo">{t('business.coverPhoto')}</Label>
              <div className="mt-2 flex items-center gap-4">
                <div
                  className="h-40 w-full rounded-md border border-input bg-cover bg-center bg-no-repeat"
                  style={{ backgroundImage: `url(${imageUrl})` }}
                />
                <div className="flex flex-col gap-2">
                  <Label
                    htmlFor="cover_photo_upload"
                    className="cursor-pointer inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Upload
                  </Label>
                  <Input
                    id="cover_photo_upload"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="name">{t('business.businessName')}</Label>
              <Input
                id="name"
                name="name"
                value={formData.name || ''}
                onChange={handleChange}
                placeholder="Your Business Name"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">{t('business.businessDescription')}</Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description || ''}
                onChange={handleChange}
                placeholder="Describe your business"
                rows={3}
              />
            </div>

            <div className="grid gap-2">
              <Label>{t('business.contactInformation')}</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="contact_phone">{t('business.contactPhone')}</Label>
                  <Input
                    id="contact_phone"
                    name="contact_phone"
                    value={formData.contact_phone || ''}
                    onChange={handleChange}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
                <div>
                  <Label htmlFor="contact_email">{t('business.contactEmail')}</Label>
                  <Input
                    id="contact_email"
                    name="contact_email"
                    value={formData.contact_email || ''}
                    onChange={handleChange}
                    placeholder="your@email.com"
                  />
                </div>
                <div>
                  <Label htmlFor="contact_website">{t('business.contactWebsite')}</Label>
                  <Input
                    id="contact_website"
                    name="contact_website"
                    value={formData.contact_website || ''}
                    onChange={handleChange}
                    placeholder="https://yourbusiness.com"
                  />
                </div>
                <div>
                  <Label htmlFor="contact_address">{t('business.contactAddress')}</Label>
                  <Input
                    id="contact_address"
                    name="contact_address"
                    value={formData.contact_address || ''}
                    onChange={handleChange}
                    placeholder="123 Business St, City"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? t('common.loading') : t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

