
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getUserBusiness, createBusiness, updateBusiness, getBusinessBySlug } from "@/lib/api";
import { BusinessFormData } from "@/lib/types/business";
import { useToast } from "@/components/ui/use-toast";

export const useBusiness = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: business, isLoading, isError } = useQuery({
    queryKey: ["business"],
    queryFn: getUserBusiness,
  });

  const createBusinessMutation = useMutation({
    mutationFn: (data: BusinessFormData) => createBusiness(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business"] });
      toast({
        title: "Success",
        description: "Business created successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create business",
        variant: "destructive",
      });
    },
  });

  const updateBusinessMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: BusinessFormData }) => updateBusiness(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business"] });
      toast({
        title: "Success",
        description: "Business updated successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update business",
        variant: "destructive",
      });
    },
  });

  return {
    business,
    isLoading,
    isError,
    hasBusiness: !!business,
    createBusiness: createBusinessMutation.mutateAsync,
    updateBusiness: updateBusinessMutation.mutateAsync,
    isSubmitting: createBusinessMutation.isPending || updateBusinessMutation.isPending,
  };
};

export const usePublicBusiness = (slug: string) => {
  return useQuery({
    queryKey: ["public-business", slug],
    queryFn: () => getBusinessBySlug(slug),
    enabled: !!slug,
    // Make sure we don't require authentication for public business pages
    retry: 3,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};
