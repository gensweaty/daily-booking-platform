
import React, { useState } from "react";
import { Business } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, ExternalLink, Phone, Mail, MapPin, Building, Calendar, Globe } from "lucide-react";
import { BusinessForm } from "./BusinessForm";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { EventRequestList } from "./EventRequestList";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useBusiness } from "@/hooks/useBusiness";
import { supabase } from "@/lib/supabase";

interface BusinessDetailsProps {
  business: Business;
  onEdit: (business: Partial<Business>, coverPhoto?: File) => Promise<void>;
  onDelete: () => Promise<void>;
}

export const BusinessDetails = ({
  business,
  onEdit,
  onDelete,
}: BusinessDetailsProps) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [coverPhotoUrl, setCoverPhotoUrl] = useState<string | null>(null);
  
  const { eventRequests, isEventRequestsLoading, approveEventRequest, rejectEventRequest } = 
    useEventRequests(business.id);

  // Fetch the cover photo URL if it exists
  React.useEffect(() => {
    const fetchCoverPhoto = async () => {
      if (business.cover_photo_path) {
        const { data } = await supabase.storage
          .from('business_covers')
          .getPublicUrl(business.cover_photo_path);
        
        if (data) {
          setCoverPhotoUrl(data.publicUrl);
        }
      }
    };
    
    fetchCoverPhoto();
  }, [business.cover_photo_path]);

  const handleEditSubmit = async (
    formData: Partial<Business>,
    coverPhoto?: File
  ) => {
    try {
      await onEdit(formData, coverPhoto);
      setIsEditDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update business",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    try {
      await onDelete();
      setIsDeleteDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete business",
        variant: "destructive",
      });
    }
  };

  const publicBusinessUrl = `${window.location.origin}/business/${business.slug}`;

  const copyPublicUrl = () => {
    navigator.clipboard.writeText(publicBusinessUrl);
    toast({
      title: "URL copied",
      description: "Public business URL copied to clipboard",
    });
  };

  return (
    <div className="space-y-8">
      <Card className="overflow-hidden">
        {coverPhotoUrl && (
          <div className="relative h-48 w-full">
            <img
              src={coverPhotoUrl}
              alt={`${business.name} cover`}
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>
        )}
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-xl font-bold">{business.name}</CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditDialogOpen(true)}
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete your
                    business and all related data.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {business.description && (
            <div className="text-muted-foreground text-sm">{business.description}</div>
          )}
          
          <div className="grid gap-3 text-sm">
            {business.contact_address && (
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                <span>{business.contact_address}</span>
              </div>
            )}
            {business.contact_phone && (
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span>{business.contact_phone}</span>
              </div>
            )}
            {business.contact_email && (
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <a href={`mailto:${business.contact_email}`} className="text-primary hover:underline">
                  {business.contact_email}
                </a>
              </div>
            )}
            {business.contact_website && (
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-muted-foreground" />
                <a href={business.contact_website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center">
                  {business.contact_website}
                  <ExternalLink className="w-3 h-3 ml-1" />
                </a>
              </div>
            )}
          </div>
          
          <div className="border-t pt-4 mt-4">
            <div className="flex flex-wrap items-center gap-2 justify-between">
              <div className="text-sm font-medium flex items-center">
                <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
                Public Booking Page
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={copyPublicUrl}>
                  Copy Link
                </Button>
                <Button size="sm" asChild>
                  <a href={publicBusinessUrl} target="_blank" rel="noopener noreferrer">
                    Visit <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <EventRequestList 
        eventRequests={eventRequests || []}
        isLoading={isEventRequestsLoading}
        onApprove={approveEventRequest}
        onReject={rejectEventRequest}
      />
      
      <BusinessForm
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        initialData={business}
        onSubmit={handleEditSubmit}
      />
    </div>
  );
};
