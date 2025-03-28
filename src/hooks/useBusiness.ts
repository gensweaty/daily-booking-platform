
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  getBusiness, 
  createBusiness, 
  updateBusiness, 
  deleteBusiness,
  uploadBusinessCoverPhoto,
  getBusinessBySlug,
  getEventRequests,
  approveEventRequest,
  rejectEventRequest
} from "@/lib/api";
import { Business, EventRequest } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";

export const useBusiness = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  // Get the user's business
  const { 
    data: business, 
    isLoading: isBusinessLoading, 
    error: businessError 
  } = useQuery({
    queryKey: ['business', user?.id],
    queryFn: getBusiness,
    enabled: !!user,
  });

  // Create a new business
  const createBusinessMutation = useMutation({
    mutationFn: createBusiness,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['business', user?.id] });
      toast({
        title: "Business created",
        description: "Your business has been successfully created.",
      });
    },
    onError: (error: any) => {
      console.error('Error creating business:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create business",
        variant: "destructive",
      });
    },
  });

  // Update business
  const updateBusinessMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Business> }) => 
      updateBusiness(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['business', user?.id] });
      toast({
        title: "Business updated",
        description: "Your business has been successfully updated.",
      });
    },
    onError: (error: any) => {
      console.error('Error updating business:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update business",
        variant: "destructive",
      });
    },
  });

  // Delete business
  const deleteBusinessMutation = useMutation({
    mutationFn: deleteBusiness,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business', user?.id] });
      toast({
        title: "Business deleted",
        description: "Your business has been successfully deleted.",
      });
    },
    onError: (error: any) => {
      console.error('Error deleting business:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete business",
        variant: "destructive",
      });
    },
  });

  // Upload business cover photo
  const uploadCoverPhotoMutation = useMutation({
    mutationFn: ({ file, businessId }: { file: File; businessId: string }) => 
      uploadBusinessCoverPhoto(file, businessId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['business', user?.id] });
      toast({
        title: "Cover photo uploaded",
        description: "Your business cover photo has been successfully uploaded.",
      });
    },
    onError: (error: any) => {
      console.error('Error uploading cover photo:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to upload cover photo",
        variant: "destructive",
      });
    },
  });

  return {
    business,
    isBusinessLoading,
    businessError,
    createBusiness: createBusinessMutation.mutateAsync,
    updateBusiness: updateBusinessMutation.mutateAsync,
    deleteBusiness: deleteBusinessMutation.mutateAsync,
    uploadCoverPhoto: uploadCoverPhotoMutation.mutateAsync,
  };
};

export const useBusinessBySlug = (slug: string | undefined) => {
  // Get a business by slug (for public page)
  return useQuery({
    queryKey: ['business', slug],
    queryFn: () => getBusinessBySlug(slug || ''),
    enabled: !!slug,
  });
};

export const useEventRequests = (businessId: string | undefined) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Get event requests for a business
  const { 
    data: eventRequests, 
    isLoading: isEventRequestsLoading, 
    error: eventRequestsError 
  } = useQuery({
    queryKey: ['eventRequests', businessId],
    queryFn: () => getEventRequests(businessId || ''),
    enabled: !!businessId,
  });

  // Approve an event request
  const approveEventRequestMutation = useMutation({
    mutationFn: approveEventRequest,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['eventRequests', businessId] });
      // Also invalidate events to show the newly created event
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast({
        title: "Event request approved",
        description: "The event has been successfully added to your calendar.",
      });
    },
    onError: (error: any) => {
      console.error('Error approving event request:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to approve event request",
        variant: "destructive",
      });
    },
  });

  // Reject an event request
  const rejectEventRequestMutation = useMutation({
    mutationFn: rejectEventRequest,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['eventRequests', businessId] });
      toast({
        title: "Event request rejected",
        description: "The event request has been rejected.",
      });
    },
    onError: (error: any) => {
      console.error('Error rejecting event request:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to reject event request",
        variant: "destructive",
      });
    },
  });

  return {
    eventRequests,
    isEventRequestsLoading,
    eventRequestsError,
    approveEventRequest: approveEventRequestMutation.mutateAsync,
    rejectEventRequest: rejectEventRequestMutation.mutateAsync,
  };
};
