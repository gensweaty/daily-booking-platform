import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useBusinessBySlug } from "@/hooks/useBusiness";
import { Calendar } from "@/components/Calendar/Calendar";
import { CalendarEventType } from "@/lib/types/calendar";
import { Button } from "@/components/ui/button";
import { ExternalLink, ArrowLeft, Mail, MapPin, Phone, Globe, Calendar as CalendarIcon, Clock } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";

const PublicBusinessPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { data: business, isLoading, error } = useBusinessBySlug(slug);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isBookingDialogOpen, setIsBookingDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [coverPhotoUrl, setCoverPhotoUrl] = useState<string | null>(null);
  const { getPublicEvents } = useCalendarEvents();
  
  useEffect(() => {
    // Reset state when slug changes
    setIsBookingDialogOpen(false);
    setSelectedDate(null);
  }, [slug]);
  
  // Fetch public events for this business
  const { data: publicEvents = [], isLoading: isLoadingEvents } = useQuery({
    queryKey: ['public-events', business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      
      try {
        const events = await getPublicEvents(business.id);
        console.log("Fetched public events:", events);
        return events;
      } catch (error) {
        console.error("Failed to fetch public events:", error);
        return [];
      }
    },
    enabled: !!business?.id,
    staleTime: 1000 * 60, // 1 minute
    refetchOnMount: true,
    refetchOnWindowFocus: true
  });
  
  // Fetch the cover photo URL if it exists
  useEffect(() => {
    const fetchCoverPhoto = async () => {
      if (business?.cover_photo_path) {
        try {
          console.log("Fetching cover photo from path:", business.cover_photo_path);
          const { data } = await supabase.storage
            .from('business_covers')
            .getPublicUrl(business.cover_photo_path);
          
          if (data) {
            console.log("Cover photo public URL:", data.publicUrl);
            setCoverPhotoUrl(data.publicUrl);
          } else {
            console.log("No public URL data returned");
          }
        } catch (error) {
          console.error("Error fetching cover photo:", error);
        }
      } else {
        console.log("No cover photo path available");
      }
    };
    
    if (business) {
      fetchCoverPhoto();
    }
  }, [business]);
  
  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setIsBookingDialogOpen(true);
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center mb-8">
            <Button asChild variant="ghost" size="sm" className="mr-2">
              <Link to="/">
                ← Home
              </Link>
            </Button>
          </div>
          <Skeleton className="h-12 w-1/3 mb-4" />
          <Skeleton className="h-6 w-1/2 mb-8" />
          <Skeleton className="h-[400px] w-full mb-8 rounded-lg" />
        </div>
      </div>
    );
  }
  
  if (error || !business) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">Business Not Found</h1>
          <p className="text-muted-foreground mb-6">
            The business you're looking for doesn't exist or has been removed.
          </p>
          <Button asChild>
            <Link to="/">Return Home</Link>
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <LanguageProvider>
      <div className="min-h-screen bg-background pb-12">
        <header className="w-full">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <Button asChild variant="ghost" size="sm">
              <Link to="/">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Link>
            </Button>
          </div>
        </header>
        
        {coverPhotoUrl ? (
          <div className="w-full h-64 md:h-80 relative mb-8">
            <img
              src={coverPhotoUrl}
              alt={`${business?.name} cover`}
              className="w-full h-full object-cover absolute inset-0"
            />
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="text-white text-center p-4">
                <h1 className="text-4xl md:text-5xl font-bold mb-2">{business?.name}</h1>
                {business?.description && (
                  <p className="max-w-2xl mx-auto text-lg">{business?.description}</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="py-12 px-4 sm:px-6 lg:px-8 text-center mb-8 bg-primary/10">
            <h1 className="text-4xl font-bold mb-2">{business?.name}</h1>
            {business?.description && (
              <p className="max-w-2xl mx-auto text-lg text-muted-foreground">{business?.description}</p>
            )}
          </div>
        )}
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="bg-card rounded-lg shadow-sm overflow-hidden mb-8">
                <div className="p-6 border-b border-border">
                  <h2 className="text-2xl font-semibold flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5 text-primary" /> 
                    Book an Appointment
                  </h2>
                </div>
                <div className="bg-background p-4">
                  {isLoadingEvents ? (
                    <div className="flex items-center justify-center py-20">
                      <Skeleton className="h-[400px] w-full" />
                    </div>
                  ) : (
                    <Calendar 
                      defaultView="month" 
                      publicMode={true}
                      externalEvents={publicEvents}
                      businessId={business?.id}
                    />
                  )}
                </div>
              </div>
            </div>
            
            <div>
              <div className="bg-card rounded-lg shadow-sm overflow-hidden sticky top-6">
                <div className="p-6 border-b border-border">
                  <h2 className="text-2xl font-semibold">Contact Information</h2>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    {business.contact_address && (
                      <div className="flex items-start gap-3">
                        <MapPin className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                        <span>{business.contact_address}</span>
                      </div>
                    )}
                    
                    {business.contact_phone && (
                      <div className="flex items-center gap-3">
                        <Phone className="w-5 h-5 text-primary flex-shrink-0" />
                        <a href={`tel:${business.contact_phone}`} className="hover:underline">
                          {business.contact_phone}
                        </a>
                      </div>
                    )}
                    
                    {business.contact_email && (
                      <div className="flex items-center gap-3">
                        <Mail className="w-5 h-5 text-primary flex-shrink-0" />
                        <a href={`mailto:${business.contact_email}`} className="hover:underline">
                          {business.contact_email}
                        </a>
                      </div>
                    )}
                    
                    {business.contact_website && (
                      <div className="flex items-center gap-3">
                        <Globe className="w-5 h-5 text-primary flex-shrink-0" />
                        <a 
                          href={business.contact_website} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="hover:underline flex items-center"
                        >
                          {business.contact_website.replace(/^https?:\/\//, '')}
                          <ExternalLink className="w-3 h-3 ml-1" />
                        </a>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-8">
                    <div className="rounded-lg bg-primary/10 p-4 mb-6">
                      <div className="flex items-center gap-2 text-sm mb-2">
                        <Clock className="w-4 h-4 text-primary" />
                        <span className="font-medium">Available for booking</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Select a date on the calendar to request a booking
                      </p>
                    </div>
                    
                    <Button 
                      className="w-full" 
                      size="lg"
                      onClick={() => setIsBookingDialogOpen(true)}
                    >
                      Book Now
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </LanguageProvider>
  );
};

export default PublicBusinessPage;
