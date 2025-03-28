
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useBusinessBySlug } from "@/hooks/useBusiness";
import { Calendar } from "@/components/Calendar/Calendar";
import { EventDialog } from "@/components/Calendar/EventDialog";
import { CalendarEventType } from "@/lib/types/calendar";
import { Button } from "@/components/ui/button";
import { createEventRequest } from "@/lib/api";
import { ExternalLink, Mail, MapPin, Phone, Globe } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabase";

const PublicBusinessPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { data: business, isLoading, error } = useBusinessBySlug(slug);
  const { toast } = useToast();
  const [isBookingDialogOpen, setIsBookingDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [coverPhotoUrl, setCoverPhotoUrl] = useState<string | null>(null);
  
  useEffect(() => {
    // Reset state when slug changes
    setIsBookingDialogOpen(false);
    setSelectedDate(null);
  }, [slug]);
  
  // Fetch the cover photo URL if it exists
  useEffect(() => {
    const fetchCoverPhoto = async () => {
      if (business?.cover_photo_path) {
        const { data } = await supabase.storage
          .from('business_covers')
          .getPublicUrl(business.cover_photo_path);
        
        if (data) {
          setCoverPhotoUrl(data.publicUrl);
        }
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
  
  const handleBookingSubmit = async (data: Partial<CalendarEventType>) => {
    if (!business) return;
    
    try {
      await createEventRequest({
        business_id: business.id,
        title: data.title || "",
        user_surname: data.user_surname,
        user_number: data.user_number,
        social_network_link: data.social_network_link,
        event_notes: data.event_notes,
        start_date: data.start_date || "",
        end_date: data.end_date || "",
        type: data.type,
        payment_status: data.payment_status,
        payment_amount: data.payment_amount
      });
      
      toast({
        title: "Booking request sent",
        description: "Your booking request has been sent successfully!",
      });
      
      setIsBookingDialogOpen(false);
      return {} as CalendarEventType; // Return empty object to satisfy the promise
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send booking request",
        variant: "destructive",
      });
      throw error;
    }
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
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
            <a href="/">Return Home</a>
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <LanguageProvider>
      <div className="min-h-screen bg-background pb-12">
        {coverPhotoUrl && (
          <div className="w-full h-64 relative">
            <img
              src={coverPhotoUrl}
              alt={`${business.name} cover`}
              className="w-full h-full object-cover absolute inset-0"
            />
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <div className="text-white text-center">
                <h1 className="text-4xl font-bold mb-2">{business.name}</h1>
                {business.description && (
                  <p className="max-w-2xl mx-auto text-lg">{business.description}</p>
                )}
              </div>
            </div>
          </div>
        )}
        
        {!coverPhotoUrl && (
          <div className="py-12 px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl font-bold mb-2">{business.name}</h1>
            {business.description && (
              <p className="max-w-2xl mx-auto text-lg text-muted-foreground">{business.description}</p>
            )}
          </div>
        )}
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="bg-card rounded-lg shadow-sm p-6">
                <h2 className="text-2xl font-semibold mb-6">Book an Appointment</h2>
                <div className="bg-background rounded-lg overflow-hidden">
                  <Calendar 
                    defaultView="month" 
                  />
                </div>
              </div>
            </div>
            
            <div>
              <div className="bg-card rounded-lg shadow-sm p-6 sticky top-6">
                <h2 className="text-2xl font-semibold mb-6">Contact Information</h2>
                <div className="space-y-4">
                  {business.contact_address && (
                    <div className="flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-muted-foreground mt-0.5" />
                      <span>{business.contact_address}</span>
                    </div>
                  )}
                  
                  {business.contact_phone && (
                    <div className="flex items-center gap-3">
                      <Phone className="w-5 h-5 text-muted-foreground" />
                      <a href={`tel:${business.contact_phone}`} className="hover:underline">
                        {business.contact_phone}
                      </a>
                    </div>
                  )}
                  
                  {business.contact_email && (
                    <div className="flex items-center gap-3">
                      <Mail className="w-5 h-5 text-muted-foreground" />
                      <a href={`mailto:${business.contact_email}`} className="hover:underline">
                        {business.contact_email}
                      </a>
                    </div>
                  )}
                  
                  {business.contact_website && (
                    <div className="flex items-center gap-3">
                      <Globe className="w-5 h-5 text-muted-foreground" />
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
                  <Button className="w-full" onClick={() => setIsBookingDialogOpen(true)}>
                    Book Now
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {selectedDate && (
          <EventDialog
            open={isBookingDialogOpen}
            onOpenChange={setIsBookingDialogOpen}
            selectedDate={selectedDate}
            onSubmit={handleBookingSubmit}
          />
        )}
      </div>
    </LanguageProvider>
  );
};

export default PublicBusinessPage;
