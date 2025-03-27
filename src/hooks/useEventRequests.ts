
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getEventRequests, approveEventRequest, rejectEventRequest, createEventRequest } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { EventRequest } from "@/lib/types/business";

export const useEventRequests = (businessId?: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: eventRequests = [], isLoading, isError } = useQuery({
    queryKey: ["eventRequests", businessId],
    queryFn: () => getEventRequests(businessId!),
    enabled: !!businessId,
  });

  const approveRequestMutation = useMutation({
    mutationFn: (id: string) => approveEventRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eventRequests"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast({
        title: "Success",
        description: "Event request approved successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve event request",
        variant: "destructive",
      });
    },
  });

  const rejectRequestMutation = useMutation({
    mutationFn: (id: string) => rejectEventRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eventRequests"] });
      toast({
        title: "Success",
        description: "Event request rejected successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reject event request",
        variant: "destructive",
      });
    },
  });

  const createRequestMutation = useMutation({
    mutationFn: (request: Omit<EventRequest, "id" | "created_at" | "updated_at" | "status">) => 
      createEventRequest(request),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Event request submitted successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit event request",
        variant: "destructive",
      });
    },
  });

  return {
    eventRequests,
    isLoading,
    isError,
    pendingRequests: eventRequests.filter(req => req.status === 'pending'),
    approvedRequests: eventRequests.filter(req => req.status === 'approved'),
    rejectedRequests: eventRequests.filter(req => req.status === 'rejected'),
    approveRequest: approveRequestMutation.mutateAsync,
    rejectRequest: rejectRequestMutation.mutateAsync,
    createRequest: createRequestMutation.mutateAsync,
    isPending: approveRequestMutation.isPending || rejectRequestMutation.isPending,
  };
};
