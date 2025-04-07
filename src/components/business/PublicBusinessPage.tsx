
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { BusinessProfile } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LoaderCircle, Globe, Mail, Phone, MapPin } from "lucide-react";
import { ExternalCalendar } from "../Calendar/ExternalCalendar";

export const PublicBusinessPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const path = window.location.pathname;
  const slugFromPath = path.match(/\/business\/([^\/]+)/)?.[1];
  const businessSlug = slug || slugFromPath;

  const [business, setBusiness] = useState<BusinessProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  console.log("[PublicBusinessPage] Using business slug:", businessSlug);

  useEffect(() => {
    const fetchBusinessProfile = async () => {
      if (!businessSlug) {
        setError("No business slug provided");
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);
        console.log("[PublicBusinessPage] Fetching business profile for slug:", businessSlug);
        
        const { data, error } = await supabase
          .from("business_profiles")
          .select("*")
          .eq("slug", businessSlug)
          .single();

        if (error) {
          console.error("Error fetching business profile:", error);
          setError("Failed to load business information");
          return;
        }
        
        if (!data) {
          console.error("No business found with slug:", businessSlug);
          setError("Business not found");
          return;
        }
        
        console.log("[PublicBusinessPage] Fetched business profile:", data);
        setBusiness(data as BusinessProfile);
        
        if (data?.business_name) {
          document.title = `${data.business_name} - Book Now`;
        }
      } catch (error) {
        console.error("Exception in fetchBusinessProfile:", error);
        setError("An unexpected error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    const fetchProfile = async () => {
      try {
        const { data: buckets } = await supabase.storage.listBuckets();
        const bookingBucketExists = buckets?.some(b => b.name === 'booking_attachments');
        
        if (!bookingBucketExists) {
          await supabase.storage.createBucket('booking_attachments', {
            public: false,
            allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
            fileSizeLimit: 5000000 // 5MB
          });
          
          console.log('Created booking_attachments storage bucket');
        }
      } catch (error) {
        console.error('Error checking/creating storage buckets:', error);
      }
    };

    fetchBusinessProfile();
    fetchProfile();
  }, [businessSlug]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoaderCircle className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading business calendar...</span>
      </div>
    );
  }

  if (error || !business) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4 py-12">
        <h1 className="text-3xl font-bold mb-4">Business Not Found</h1>
        <p className="text-center text-muted-foreground">
          {error || "Sorry, we couldn't find a business with this URL. Please check the URL and try again."}
        </p>
        <Button className="mt-6" onClick={() => window.location.href = "/"}>
          Back to Homepage
        </Button>
      </div>
    );
  }

  console.log("[PublicBusinessPage] Rendering calendar for business ID:", business.id);

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-16">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{business.business_name}</h1>
          {business.description && <p className="text-lg opacity-90 max-w-2xl">{business.description}</p>}
          
          <div className="flex gap-4 mt-6">
            <Button 
              size="lg" 
              className="bg-white text-blue-700 hover:bg-blue-50"
              onClick={() => {
                document.getElementById('calendar-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              View & Book Calendar
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        <div className="mb-8" id="calendar-section">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Available Times</h2>
            <div className="text-sm text-muted-foreground">
              Click on any time slot to request a booking
            </div>
          </div>
          
          {business.id && (
            <ExternalCalendar 
              businessId={business.id} 
              loading={false} 
              events={[]} 
              bookings={[]} 
            />
          )}
        </div>

        <div className="mt-12">
          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="text-xl font-semibold">Contact Information</h2>
              
              <div className="grid md:grid-cols-2 gap-6">
                {business.contact_email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-blue-600" />
                    <a href={`mailto:${business.contact_email}`} className="hover:underline">
                      {business.contact_email}
                    </a>
                  </div>
                )}
                
                {business.contact_phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-blue-600" />
                    <a href={`tel:${business.contact_phone}`} className="hover:underline">
                      {business.contact_phone}
                    </a>
                  </div>
                )}
                
                {business.contact_address && (
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-blue-600" />
                    <span>{business.contact_address}</span>
                  </div>
                )}
                
                {business.contact_website && (
                  <div className="flex items-center gap-3">
                    <Globe className="h-5 w-5 text-blue-600" />
                    <a 
                      href={business.contact_website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {business.contact_website.replace(/^https?:\/\//, '')}
                    </a>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
