
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { BusinessProfile } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LoaderCircle, Globe, Mail, Phone, MapPin } from "lucide-react";
import { ExternalCalendar } from "../Calendar/ExternalCalendar";

export const PublicBusinessPage = () => {
  // Extract the slug from the URL path manually since useParams doesn't work in our case
  const path = window.location.pathname;
  const slugMatch = path.match(/\/business\/([^\/]+)/);
  const slug = slugMatch ? slugMatch[1] : '';
  
  const [showCalendar, setShowCalendar] = useState(true);

  const { data: business, isLoading } = useQuery({
    queryKey: ["businessProfile", slug],
    queryFn: async () => {
      if (!slug) throw new Error("No business slug provided");
      
      console.log("PublicBusinessPage: Fetching business profile for slug:", slug);
      const { data, error } = await supabase
        .from("business_profiles")
        .select("*")
        .eq("slug", slug)
        .single();

      if (error) {
        console.error("Error fetching business profile:", error);
        throw error;
      }
      
      console.log("PublicBusinessPage: Fetched business profile:", data);
      return data as BusinessProfile;
    },
    enabled: !!slug,
    staleTime: 1000 * 60, // 1 minute
  });

  useEffect(() => {
    // Set the page title
    if (business?.business_name) {
      document.title = `${business.business_name} - Book Now`;
    }
    
    // Debug log
    if (business) {
      console.log("PublicBusinessPage: Business data loaded:", {
        id: business.id,
        name: business.business_name,
        userId: business.user_id
      });
    }
  }, [business]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoaderCircle className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!business) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4 py-12">
        <h1 className="text-3xl font-bold mb-4">Business Not Found</h1>
        <p className="text-center text-muted-foreground">
          Sorry, we couldn't find a business with this URL. Please check the URL and try again.
        </p>
        <Button className="mt-6" onClick={() => window.location.href = "/"}>
          Back to Homepage
        </Button>
      </div>
    );
  }

  console.log("PublicBusinessPage: Rendering with businessId:", business.id);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-16">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{business.business_name}</h1>
          {business.description && <p className="text-lg opacity-90 max-w-2xl">{business.description}</p>}
          
          <div className="flex gap-4 mt-6">
            <Button 
              size="lg" 
              className="bg-white text-blue-700 hover:bg-blue-50"
              onClick={() => {
                setShowCalendar(true);
                console.log("View calendar button clicked");
              }}
            >
              View & Book Calendar
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Available Times</h2>
            <div className="text-sm text-muted-foreground">
              Click on any time slot to request a booking
            </div>
          </div>
          
          {business.id && (
            <>
              {console.log("PublicBusinessPage: Rendering ExternalCalendar with businessId:", business.id)}
              <ExternalCalendar 
                businessId={business.id} 
              />
            </>
          )}
        </div>

        {/* Contact Information */}
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
