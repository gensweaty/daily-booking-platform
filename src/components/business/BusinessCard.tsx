
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Pencil, Globe, Phone, Mail, MapPin, ExternalLink } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";

interface BusinessData {
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

interface BusinessCardProps {
  business: BusinessData;
  onEdit: () => void;
}

export const BusinessCard = ({ business, onEdit }: BusinessCardProps) => {
  const { t } = useLanguage();
  const [coverPhotoUrl, setCoverPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchCoverPhoto = async () => {
      if (business.cover_photo_path) {
        try {
          const { data, error } = await supabase.storage
            .from('business-photos')
            .getPublicUrl(business.cover_photo_path);
          
          if (error) throw error;
          setCoverPhotoUrl(data.publicUrl);
        } catch (error) {
          console.error("Error fetching cover photo:", error);
        }
      }
    };

    fetchCoverPhoto();
  }, [business.cover_photo_path]);

  const publicUrl = window.location.origin + '/business/' + business.slug;

  return (
    <Card className="w-full">
      <CardHeader className="relative pb-0">
        {coverPhotoUrl && (
          <div className="absolute inset-0 bg-cover bg-center rounded-t-lg h-40" 
               style={{ backgroundImage: `url(${coverPhotoUrl})` }}>
            <div className="absolute inset-0 bg-black/40 rounded-t-lg"></div>
          </div>
        )}
        
        <div className={`relative ${coverPhotoUrl ? 'text-white pt-16 pb-4' : ''}`}>
          <CardTitle className="text-2xl">{business.name}</CardTitle>
          {business.description && <CardDescription className={`mt-2 ${coverPhotoUrl ? 'text-gray-200' : 'text-gray-500'}`}>{business.description}</CardDescription>}
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {business.contact_phone && (
            <div className="flex items-start gap-2">
              <Phone className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-sm text-muted-foreground">{t("business.contactPhone")}</div>
                <div>{business.contact_phone}</div>
              </div>
            </div>
          )}
          
          {business.contact_email && (
            <div className="flex items-start gap-2">
              <Mail className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-sm text-muted-foreground">{t("business.contactEmail")}</div>
                <div>{business.contact_email}</div>
              </div>
            </div>
          )}
          
          {business.contact_website && (
            <div className="flex items-start gap-2">
              <Globe className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-sm text-muted-foreground">{t("business.contactWebsite")}</div>
                <a href={business.contact_website.startsWith('http') ? business.contact_website : `https://${business.contact_website}`} 
                   target="_blank" 
                   rel="noopener noreferrer"
                   className="text-primary hover:underline">
                  {business.contact_website}
                </a>
              </div>
            </div>
          )}
          
          {business.contact_address && (
            <div className="flex items-start gap-2">
              <MapPin className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-sm text-muted-foreground">{t("business.contactAddress")}</div>
                <div>{business.contact_address}</div>
              </div>
            </div>
          )}
        </div>
        
        <div className="pt-4">
          <div className="font-medium text-sm text-muted-foreground mb-2">{t("business.publicPage")}</div>
          <a 
            href={publicUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-primary hover:underline"
          >
            {publicUrl}
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </CardContent>
      <CardFooter className="flex justify-end pt-2">
        <Button variant="outline" onClick={onEdit} className="flex items-center gap-2">
          <Pencil className="h-4 w-4" />
          {t("common.edit")}
        </Button>
      </CardFooter>
    </Card>
  );
};
