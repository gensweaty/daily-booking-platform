
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { Check, X, Calendar, Clock, User, Mail, Phone, FileText, Loader2, Eye } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/components/ui/use-toast";
import { EventDialog } from "../Calendar/EventDialog";
import { CalendarEventType } from "@/lib/types/calendar";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";

export const BookingApprovalList = () => {
  const [pendingBookings, setPendingBookings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  const [viewingEvent, setViewingEvent] = useState<CalendarEventType | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  const fetchPendingBookings = async () => {
    setIsLoading(true);
    try {
      // Get the user's business profile
      const { data: authData } = await supabase.auth.getUser();
      
      if (!authData?.user) {
        setIsLoading(false);
        return;
      }
      
      const { data: businessProfile, error: businessError } = await supabase
        .from('business_profiles')
        .select('id')
        .eq('user_id', authData.user.id)
        .single();
      
      if (businessError || !businessProfile) {
        console.error("Error fetching business profile:", businessError);
        setIsLoading(false);
        return;
      }
      
      const { data, error } = await supabase
        .from('booking_requests')
        .select('*')
        .eq('business_id', businessProfile.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error("Error fetching pending bookings:", error);
        throw error;
      }
      
      console.log("Fetched pending bookings:", data);
      setPendingBookings(data || []);
    } catch (error) {
      console.error("Error fetching pending bookings:", error);
      toast({
        title: "Error",
        description: "Failed to load booking requests",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingBookings();
    
    // Set up a subscription for real-time updates
    const channel = supabase
      .channel('booking-requests-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'booking_requests'
        },
        () => {
          fetchPendingBookings();
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleApprove = async (id: string) => {
    try {
      // Get the booking details first
      const { data: booking, error: bookingError } = await supabase
        .from('booking_requests')
        .select('*')
        .eq('id', id)
        .single();
      
      if (bookingError || !booking) {
        throw bookingError || new Error("Booking not found");
      }
      
      // Update the booking status
      const { error: updateError } = await supabase
        .from('booking_requests')
        .update({ status: 'approved' })
        .eq('id', id);
      
      if (updateError) throw updateError;
      
      // Create an event in the calendar
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .insert([{
          title: booking.title,
          user_surname: booking.requester_name,
          user_number: booking.requester_phone,
          social_network_link: booking.requester_email,
          event_notes: booking.description,
          start_date: booking.start_date,
          end_date: booking.end_date,
          type: 'booking_request',
          user_id: booking.user_id || booking.business_id, // Use business ID as fallback
          created_at: new Date().toISOString()
        }])
        .select()
        .single();
      
      if (eventError) throw eventError;
      
      // Create a customer in the CRM
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .insert([{
          title: booking.title,
          user_surname: booking.requester_name,
          user_number: booking.requester_phone,
          social_network_link: booking.requester_email,
          event_notes: booking.description,
          start_date: booking.start_date,
          end_date: booking.end_date,
          type: 'customer',
          user_id: booking.user_id || booking.business_id, // Use business ID as fallback
        }])
        .select()
        .single();
      
      if (customerError) throw customerError;
      
      // Transfer any attached files
      const { data: bookingFiles } = await supabase
        .from('booking_files')
        .select('*')
        .eq('booking_id', id);
      
      if (bookingFiles && bookingFiles.length > 0) {
        for (const file of bookingFiles) {
          // Create event file
          await supabase
            .from('event_files')
            .insert({
              event_id: eventData.id,
              filename: file.filename,
              file_path: file.file_path,
              content_type: file.content_type,
              size: file.size,
              user_id: booking.user_id
            });
          
          // Create customer file
          await supabase
            .from('customer_files_new')
            .insert({
              customer_id: customerData.id,
              filename: file.filename,
              file_path: file.file_path,
              content_type: file.content_type,
              size: file.size,
              user_id: booking.user_id
            });
        }
      }
      
      // Update local state
      setPendingBookings(prevBookings => 
        prevBookings.filter(booking => booking.id !== id)
      );
      
      // Refresh related data
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['business-events'] });
      queryClient.invalidateQueries({ queryKey: ['approved-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      
      toast({
        title: "Success",
        description: "Booking request approved"
      });
    } catch (error: any) {
      console.error("Error approving booking:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to approve booking",
        variant: "destructive"
      });
    }
  };

  const handleReject = async (id: string) => {
    try {
      const { error } = await supabase
        .from('booking_requests')
        .update({ status: 'rejected' })
        .eq('id', id);
      
      if (error) throw error;
      
      // Update local state
      setPendingBookings(prevBookings => 
        prevBookings.filter(booking => booking.id !== id)
      );
      
      toast({
        title: "Success",
        description: "Booking request rejected"
      });
    } catch (error: any) {
      console.error("Error rejecting booking:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to reject booking",
        variant: "destructive"
      });
    }
  };

  const handleViewDetails = (booking: any) => {
    const bookingAsEvent: CalendarEventType = {
      id: booking.id,
      title: booking.title,
      user_surname: booking.requester_name,
      user_number: booking.requester_phone,
      social_network_link: booking.requester_email,
      event_notes: booking.description,
      start_date: booking.start_date,
      end_date: booking.end_date,
      type: 'booking_request',
      created_at: booking.created_at,
      user_id: booking.user_id || booking.business_id,
    };
    
    setViewingEvent(bookingAsEvent);
  };

  const handleEventDialogUpdate = async (data: Partial<CalendarEventType>) => {
    if (!viewingEvent) return viewingEvent as CalendarEventType;
    
    try {
      // Update the booking request
      const { error } = await supabase
        .from('booking_requests')
        .update({
          title: data.title,
          requester_name: data.user_surname,
          requester_phone: data.user_number,
          requester_email: data.social_network_link,
          description: data.event_notes,
          start_date: data.start_date,
          end_date: data.end_date,
        })
        .eq('id', viewingEvent.id);
      
      if (error) throw error;
      
      // Refresh booking list
      fetchPendingBookings();
      
      toast({
        title: "Success",
        description: "Booking request updated"
      });
      
      const updatedEvent = {
        ...viewingEvent,
        ...data
      };
      
      return updatedEvent as CalendarEventType;
    } catch (error: any) {
      console.error("Error updating booking:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update booking",
        variant: "destructive"
      });
      throw error;
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Pending Booking Requests</h2>
        <Badge variant="outline" className="px-3 py-1">
          {pendingBookings.length} Pending
        </Badge>
      </div>
      
      {pendingBookings.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">No pending booking requests</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {pendingBookings.map((booking) => (
            <Card key={booking.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{booking.title}</CardTitle>
                    <CardDescription>
                      Requested on {format(new Date(booking.created_at), "PPP")}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary">{booking.status}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span className="text-sm">
                      {format(new Date(booking.start_date), "PP")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    <span className="text-sm">
                      {format(new Date(booking.start_date), "p")} - {format(new Date(booking.end_date), "p")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />
                    <span className="text-sm">{booking.requester_name}</span>
                  </div>
                  {booking.requester_email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-primary" />
                      <span className="text-sm">{booking.requester_email}</span>
                    </div>
                  )}
                  {booking.requester_phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-primary" />
                      <span className="text-sm">{booking.requester_phone}</span>
                    </div>
                  )}
                  {booking.description && (
                    <div className="flex items-start gap-2">
                      <FileText className="h-4 w-4 text-primary mt-0.5" />
                      <span className="text-sm">{booking.description}</span>
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2 mt-4">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => handleViewDetails(booking)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </Button>
                  <Button 
                    variant="default" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => handleApprove(booking.id)}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Approve
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => handleReject(booking.id)}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      {viewingEvent && (
        <EventDialog
          open={!!viewingEvent}
          onOpenChange={() => setViewingEvent(null)}
          selectedDate={new Date(viewingEvent.start_date)}
          event={viewingEvent}
          onSubmit={handleEventDialogUpdate}
          isBookingRequest={true}
        />
      )}
    </div>
  );
};
