
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { BusinessDialog } from "./BusinessDialog";
import { format } from "date-fns";
import { useBusiness } from "@/hooks/useBusiness";
import { ExternalLink, ClipboardCopy, PlusCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/lib/supabase";

export const BusinessTab = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [coverPhotoUrl, setCoverPhotoUrl] = useState<string | null>(null);
  const { business, isLoading, createBusiness, updateBusiness } = useBusiness();
  const { toast } = useToast();
  const { t } = useLanguage();
  
  useEffect(() => {
    const getCoverPhotoUrl = async () => {
      if (business?.cover_photo_path) {
        try {
          const { data: fileData } = await supabase.storage
            .from('business_photos')
            .getPublicUrl(business.cover_photo_path);
          
          if (fileData) {
            setCoverPhotoUrl(fileData.publicUrl);
          }
        } catch (error) {
          console.error('Error getting cover photo URL:', error);
        }
      }
    };
    
    if (business) {
      getCoverPhotoUrl();
    }
  }, [business]);
  
  const handleDialogClose = (saved: boolean) => {
    setIsDialogOpen(false);
    // No need to call refetch here, as useBusiness is likely using React Query already
  };
  
  const copyLinkToClipboard = () => {
    if (business?.slug) {
      // Generate absolute URL to the business page
      const publicUrl = `${window.location.origin}/${business.slug}`;
      navigator.clipboard.writeText(publicUrl);
      
      toast({
        title: t('business.linkCopied'),
        duration: 2000,
      });
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">{t('business.management')}</h2>
        <div>
          {business ? (
            <Button onClick={() => setIsDialogOpen(true)}>
              {t('common.edit')}
            </Button>
          ) : (
            <Button onClick={() => setIsDialogOpen(true)}>
              <PlusCircle className="mr-2 h-4 w-4" />
              {t('businessSettings.createBusiness')}
            </Button>
          )}
        </div>
      </div>
      
      <p className="text-muted-foreground">{t('business.manageDesc')}</p>
      
      <Separator />
      
      {business ? (
        <div className="space-y-8">
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">{t('business.details')}</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <p className="font-medium">{t('businessSettings.name')}</p>
                <p className="text-muted-foreground">{business.name || t('business.noName')}</p>
                
                <p className="font-medium mt-4">{t('businessSettings.description')}</p>
                <p className="text-muted-foreground">{business.description || t('business.noDescription')}</p>
                
                <p className="font-medium mt-4">{t('business.created')}</p>
                <p className="text-muted-foreground">
                  {business.created_at ? format(new Date(business.created_at), 'PPP') : '—'}
                </p>
              </div>
              
              <div className="space-y-4">
                <p className="font-medium">{t('businessSettings.coverPhoto')}</p>
                {coverPhotoUrl ? (
                  <img 
                    src={coverPhotoUrl} 
                    alt={business.name}
                    className="rounded-md w-full h-40 object-cover"
                  />
                ) : (
                  <div className="bg-muted rounded-md w-full h-40 flex items-center justify-center">
                    <p className="text-muted-foreground">{t('business.noCoverPhoto')}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">{t('business.publicPagePreview')}</h3>
            <p className="text-muted-foreground">{t('business.publicPageAvailable')}</p>
            
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 bg-card p-4 rounded-md border flex items-center">
                <span className="text-muted-foreground mr-2 truncate">
                  {`${window.location.origin}/${business.slug}`}
                </span>
              </div>
              
              <Button
                variant="outline"
                className="flex items-center gap-2"
                onClick={copyLinkToClipboard}
              >
                <ClipboardCopy className="h-4 w-4" />
                {t('businessSettings.copyLink')}
              </Button>
              
              <Button
                className="flex items-center gap-2"
                onClick={() => window.open(`/${business.slug}`, '_blank')}
              >
                <ExternalLink className="h-4 w-4" />
                {t('businessSettings.viewPublicPage')}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="py-8 text-center space-y-4">
          <h3 className="text-xl font-semibold">{t('businessSettings.noBusiness')}</h3>
          <p className="text-muted-foreground max-w-md mx-auto">{t('business.addBusinessDesc')}</p>
          <Button onClick={() => setIsDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            {t('businessSettings.addBusiness')}
          </Button>
        </div>
      )}
      
      <BusinessDialog 
        open={isDialogOpen} 
        onClose={handleDialogClose} 
        business={business}
      />
    </div>
  );
};
