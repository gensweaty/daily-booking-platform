
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Calendar } from "@/components/Calendar/Calendar";
import { Loader2, ChevronLeft, Globe, Phone, Mail, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

interface Business {
  id: string;
  name: string;
  description?: string;
  contact_phone?: string;
  contact_address?: string;
  contact_email?: string;
  contact_website?: string;
  cover_photo_path?: string;
}

export const BusinessPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useLanguage();
  const [business, setBusiness] = useState<Business | null>(null);
  const [coverPhotoUrl, setCoverPhotoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBusiness = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        if (!slug) {
          setError("Business not found");
          return;
        }
        
        const { data, error } = await supabase
          .from("businesses")
          .select("*")
          .eq("slug", slug)
          .maybeSingle();

        if (error) throw error;
        
        if (!data) {
          setError("Business not found");
          return;
        }
        
        setBusiness(data);
        
        // Fetch cover photo if available
        if (data.cover_photo_path) {
          const { data: fileData, error: fileError } = await supabase.storage
            .from('business-photos')
            .getPublicUrl(data.cover_photo_path);
          
          if (fileError) throw fileError;
          setCoverPhotoUrl(fileData.publicUrl);
        }
      } catch (error: any) {
        console.error("Error fetching business:", error);
        setError(error.message || "Failed to load business information");
      } finally {
        setIsLoading(false);
      }
    };

    fetchBusiness();
  }, [slug]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !business) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Business Not Found</h1>
        <p className="text-muted-foreground mb-8">The business you're looking for doesn't exist or has been removed.</p>
        <Link to="/">
          <Button>
            <ChevronLeft className="mr-2 h-4 w-4" />
            Return to Home
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero section with cover photo */}
      <div className="relative h-64 md:h-80 w-full bg-gradient-to-r from-primary/90 to-primary/40">
        {coverPhotoUrl ? (
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${coverPhotoUrl})` }}>
            <div className="absolute inset-0 bg-black/40"></div>
          </div>
        ) : null}
        
        <div className="container mx-auto px-4 h-full flex flex-col justify-end pb-8 relative">
          <h1 className="text-3xl md:text-4xl font-bold text-white">{business.name}</h1>
          {business.description && (
            <p className="mt-2 text-white/90 max-w-2xl">{business.description}</p>
          )}
        </div>
      </div>
      
      {/* Main content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sidebar with business info */}
          <div className="order-2 lg:order-1">
            <div className="bg-card rounded-lg shadow-sm p-6 sticky top-8">
              <h2 className="text-xl font-semibold mb-4">Contact Information</h2>
              <div className="space-y-4">
                {business.contact_phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Phone</p>
                      <p>{business.contact_phone}</p>
                    </div>
                  </div>
                )}
                
                {business.contact_email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p>{business.contact_email}</p>
                    </div>
                  </div>
                )}
                
                {business.contact_website && (
                  <div className="flex items-center gap-3">
                    <Globe className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Website</p>
                      <a 
                        href={business.contact_website.startsWith('http') ? business.contact_website : `https://${business.contact_website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {business.contact_website}
                      </a>
                    </div>
                  </div>
                )}
                
                {business.contact_address && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-primary shrink-0 mt-1" />
                    <div>
                      <p className="text-sm text-muted-foreground">Address</p>
                      <p>{business.contact_address}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Booking calendar */}
          <div className="order-1 lg:order-2 lg:col-span-2">
            <h2 className="text-2xl font-bold mb-6">Book an Appointment</h2>
            <div className="bg-card rounded-lg shadow-sm p-4 md:p-6">
              <Calendar
                defaultView="week"
                isPublic={true}
                businessId={business.id}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
