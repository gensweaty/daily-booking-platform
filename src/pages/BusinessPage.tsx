
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Business } from "@/lib/types/business";
import { ArrowLeft, Calendar, Mail, MapPin, Phone, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BusinessPublicEventDialog } from "@/components/business/BusinessPublicEventDialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "next-themes";

const BusinessPage = () => {
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [coverPhotoUrl, setCoverPhotoUrl] = useState<string | null>(null);
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { theme } = useTheme();
  
  useEffect(() => {
    const fetchBusiness = async () => {
      try {
        setLoading(true);
        
        if (!slug) {
          console.error('No slug provided');
          setLoading(false);
          return;
        }
        
        // Direct database query to get the business by slug
        const { data, error } = await supabase
          .from('businesses')
          .select('*')
          .eq('slug', slug)
          .single();
        
        if (error) {
          console.error('Error fetching business:', error);
          setLoading(false);
          return;
        }
        
        if (!data) {
          console.log('Business not found');
          setLoading(false);
          return;
        }
        
        console.log('Business data loaded:', data);
        setBusiness(data);
        
        // Fetch cover photo if it exists
        if (data.cover_photo_path) {
          const { data: fileData } = await supabase.storage
            .from('business_photos')
            .getPublicUrl(data.cover_photo_path);
          
          if (fileData) {
            setCoverPhotoUrl(fileData.publicUrl);
          }
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchBusiness();
  }, [slug]);
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }
  
  if (!business) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold mb-4">{t('business.businessNotFound')}</h1>
        <p className="text-muted-foreground mb-6">{t('business.businessRemoved')}</p>
        <Button onClick={() => navigate('/')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('common.home')}
        </Button>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-background">
      {/* Cover photo */}
      <div className="relative h-64 md:h-80 bg-muted">
        {coverPhotoUrl ? (
          <img
            src={coverPhotoUrl}
            alt={business.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <p className="text-muted-foreground">{t('business.noCoverPhoto')}</p>
          </div>
        )}
        <div className="absolute top-4 left-4">
          <Button
            variant="outline"
            size="sm"
            className="bg-background/80 backdrop-blur-sm"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('common.home')}
          </Button>
        </div>
      </div>
      
      <div className="container px-4 py-8 max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row gap-8">
          <div className="flex-1 space-y-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">{business.name}</h1>
              <p className="text-muted-foreground">
                {business.description || t('business.noDescription')}
              </p>
            </div>
            
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">{t('common.contact')}</h2>
              <div className="space-y-2">
                {business.contact_phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{business.contact_phone}</span>
                  </div>
                )}
                {business.contact_email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a 
                      href={`mailto:${business.contact_email}`}
                      className="text-primary hover:underline"
                    >
                      {business.contact_email}
                    </a>
                  </div>
                )}
                {business.contact_address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
                    <span>{business.contact_address}</span>
                  </div>
                )}
                {business.contact_website && (
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <a 
                      href={business.contact_website.startsWith('http') 
                        ? business.contact_website 
                        : `https://${business.contact_website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {business.contact_website}
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="md:w-1/3 space-y-6">
            <div className="bg-card rounded-lg p-6 shadow-sm border">
              <h3 className="font-medium mb-4">{t('common.bookingCalendar')}</h3>
              <Button 
                className="w-full flex items-center justify-center gap-2"
                onClick={() => setIsEventDialogOpen(true)}
              >
                <Calendar className="h-4 w-4" />
                {t('business.bookNow')}
              </Button>
            </div>
            
            <div className="bg-muted/30 rounded-lg p-4 text-sm">
              <div className="flex items-center gap-2 mb-2">
                <img 
                  src={theme === 'dark' 
                    ? "/lovable-uploads/cfb84d8d-bdf9-4515-9179-f707416ece03.png"
                    : "/lovable-uploads/d1ee79b8-2af0-490e-969d-9101627c9e52.png"
                  }
                  alt="SmartBookly Logo" 
                  className="h-5 w-auto"
                />
                <span className="text-xs text-muted-foreground">{t('business.poweredBy')} SmartBookly</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <BusinessPublicEventDialog
        open={isEventDialogOpen}
        onOpenChange={setIsEventDialogOpen}
        selectedDate={new Date()}
        businessId={business.id}
      />
    </div>
  );
};

export default BusinessPage;
