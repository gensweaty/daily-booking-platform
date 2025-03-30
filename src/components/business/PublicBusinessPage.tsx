
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { BusinessProfile } from "@/types/database";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { BookingRequestForm } from "./BookingRequestForm";
import { LoaderCircle, Globe, Mail, Phone, MapPin, Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/Calendar/Calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const PublicBusinessPage = () => {
  // Extract the slug from the URL path manually since useParams doesn't work in our case
  const path = window.location.pathname;
  const slugMatch = path.match(/\/business\/([^\/]+)/);
  const slug = slugMatch ? slugMatch[1] : '';
  
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isBookingFormOpen, setIsBookingFormOpen] = useState(false);
  const [calendarView, setCalendarView] = useState<"month" | "week" | "day">("month");

  const { data: business, isLoading } = useQuery({
    queryKey: ["businessProfile", slug],
    queryFn: async () => {
      if (!slug) throw new Error("No business slug provided");
      
      const { data, error } = await supabase
        .from("business_profiles")
        .select("*")
        .eq("slug", slug)
        .single();

      if (error) throw error;
      return data as BusinessProfile;
    },
    enabled: !!slug
  });

  const { data: events = [], isLoading: isLoadingEvents } = useQuery({
    queryKey: ["businessEvents", business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("business_id", business.id)
        .order("start_date", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!business?.id
  });

  useEffect(() => {
    // Set the page title
    if (business?.business_name) {
      document.title = `${business.business_name} - Book Now`;
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

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-16">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{business.business_name}</h1>
          {business.description && <p className="text-lg opacity-90 max-w-2xl">{business.description}</p>}
          
          <Button 
            size="lg" 
            className="mt-6 bg-white text-blue-700 hover:bg-blue-50"
            onClick={() => setIsBookingFormOpen(true)}
          >
            Book an Appointment
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Left Column - Contact Info */}
          <div className="md:col-span-1 space-y-6">
            <Card>
              <CardContent className="p-6 space-y-4">
                <h2 className="text-xl font-semibold">Contact Information</h2>
                
                <div className="space-y-3">
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
            
            <Card>
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold mb-4">Quick Booking</h2>
                <p className="text-muted-foreground mb-4">
                  Select a date on the calendar to book your appointment with us.
                </p>
                <Button 
                  className="w-full"
                  onClick={() => setIsBookingFormOpen(true)}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  Book Appointment
                </Button>
              </CardContent>
            </Card>
          </div>
          
          {/* Right Column - Calendar and Booking Form */}
          <div className="md:col-span-2">
            <Card>
              <CardContent className="p-6">
                {isBookingFormOpen ? (
                  <BookingRequestForm 
                    businessId={business.id}
                    selectedDate={selectedDate}
                    onSuccess={() => setIsBookingFormOpen(false)}
                  />
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <h2 className="text-2xl font-bold">Available Dates</h2>
                      <Tabs value={calendarView} onValueChange={(v) => setCalendarView(v as "month" | "week" | "day")}>
                        <TabsList>
                          <TabsTrigger value="month">Month</TabsTrigger>
                          <TabsTrigger value="week">Week</TabsTrigger>
                          <TabsTrigger value="day">Day</TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>
                    
                    <div className="h-[600px]">
                      <Calendar 
                        defaultView={calendarView} 
                        isPublic={true}
                        publicBusinessId={business.id}
                        onDateSelected={(date) => {
                          setSelectedDate(date);
                          setIsBookingFormOpen(true);
                        }} 
                      />
                    </div>
                    
                    <div className="text-center pt-4">
                      <Button 
                        size="lg" 
                        onClick={() => setIsBookingFormOpen(true)}
                      >
                        Book for {selectedDate ? format(selectedDate, 'MMMM d, yyyy') : 'Selected Date'}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
