
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil, ExternalLink } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { BusinessData } from "./BusinessDialog";
import { supabase } from "@/lib/supabase";

interface BusinessCardProps {
  business: BusinessData;
  onEdit: () => void;
}

export const BusinessCard = ({ business, onEdit }: BusinessCardProps) => {
  const { t } = useLanguage();
  
  const getCoverPhotoUrl = async (): Promise<string | null> => {
    if (!business.cover_photo_path) return null;
    
    try {
      const { data } = await supabase.storage
        .from('business-photos')
        .getPublicUrl(business.cover_photo_path);
        
      return data.publicUrl;
    } catch (error) {
      console.error("Error getting cover photo URL:", error);
      return null;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-xl font-bold">{business.name}</CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={onEdit}
              title={t("business.editBusiness")}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              asChild
              title={t("business.viewPublicPage")}
            >
              <a href={`/business/${business.slug}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {business.cover_photo_path && (
            <div className="h-[200px] w-full overflow-hidden rounded-md">
              <img
                src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/business-photos/${business.cover_photo_path}`}
                alt={business.name}
                className="h-full w-full object-cover"
                onError={(e) => {
                  // Fallback if image fails to load
                  (e.target as HTMLImageElement).src = "/placeholder.svg";
                }}
              />
            </div>
          )}
          
          {business.description && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">
                {t("business.description")}
              </h3>
              <p className="text-sm">{business.description}</p>
            </div>
          )}
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {business.contact_phone && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">
                  {t("business.contactPhone")}
                </h3>
                <p className="text-sm">{business.contact_phone}</p>
              </div>
            )}
            
            {business.contact_email && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">
                  {t("business.contactEmail")}
                </h3>
                <p className="text-sm">
                  <a 
                    href={`mailto:${business.contact_email}`}
                    className="text-primary hover:underline"
                  >
                    {business.contact_email}
                  </a>
                </p>
              </div>
            )}
            
            {business.contact_website && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">
                  {t("business.contactWebsite")}
                </h3>
                <p className="text-sm">
                  <a 
                    href={business.contact_website.startsWith('http') ? business.contact_website : `https://${business.contact_website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {business.contact_website}
                  </a>
                </p>
              </div>
            )}
            
            {business.contact_address && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">
                  {t("business.contactAddress")}
                </h3>
                <p className="text-sm whitespace-pre-line">{business.contact_address}</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
