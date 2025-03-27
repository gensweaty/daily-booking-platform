
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { Business } from "@/lib/types/business";

export const useBusiness = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Get user's business
  const { data: business, isLoading } = useQuery({
    queryKey: ['business', user?.id],
    queryFn: async (): Promise<Business | null> => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (error) {
        if (error.code !== 'PGRST116') { // PGRST116 is "no rows returned" which is expected if no business
          console.error('Error fetching business:', error);
          toast({
            title: "Error",
            description: "Failed to load business data",
            variant: "destructive",
          });
        }
        return null;
      }
      
      return data;
    },
    enabled: !!user,
  });

  // Create business
  const createBusiness = useMutation({
    mutationFn: async (businessData: Omit<Business, "id" | "user_id" | "created_at" | "updated_at">) => {
      if (!user) throw new Error("User must be logged in to create a business");
      
      // Generate slug from business name
      let slug = businessData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      
      // Check if slug already exists
      const { data: existingBusiness, error: checkError } = await supabase
        .from('businesses')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();
      
      if (checkError) throw checkError;
      
      // If slug exists, add a random suffix
      if (existingBusiness) {
        slug = `${slug}-${Math.floor(Math.random() * 1000)}`;
      }
      
      const { data, error } = await supabase
        .from('businesses')
        .insert([{
          ...businessData,
          slug,
          user_id: user.id
        }])
        .select()
        .single();
      
      if (error) throw error;
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business', user?.id] });
      toast({
        title: "Success",
        description: "Business created successfully",
      });
    },
    onError: (error: any) => {
      console.error('Error creating business:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create business",
        variant: "destructive",
      });
    }
  });

  // Update business
  const updateBusiness = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Business> }) => {
      if (!user) throw new Error("User must be logged in to update a business");
      
      const { data, error } = await supabase
        .from('businesses')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();
      
      if (error) throw error;
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business', user?.id] });
      toast({
        title: "Success",
        description: "Business updated successfully",
      });
    },
    onError: (error: any) => {
      console.error('Error updating business:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update business",
        variant: "destructive",
      });
    }
  });

  // Upload cover photo
  const uploadCoverPhoto = async (businessId: string, file: File): Promise<string> => {
    if (!user) throw new Error("User must be logged in to upload a file");
    
    const fileExt = file.name.split('.').pop();
    const filePath = `business_covers/${businessId}/${Math.random().toString(36).substring(2)}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('public')
      .upload(filePath, file);
    
    if (uploadError) throw uploadError;
    
    const { data } = supabase.storage
      .from('public')
      .getPublicUrl(filePath);
    
    return data.publicUrl;
  };

  // Get public business by slug
  const getBusinessBySlug = async (slug: string): Promise<Business | null> => {
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('slug', slug)
      .single();
    
    if (error) {
      console.error('Error fetching business by slug:', error);
      return null;
    }
    
    return data;
  };

  return {
    business,
    isLoading,
    createBusiness: createBusiness.mutateAsync,
    updateBusiness: updateBusiness.mutateAsync,
    uploadCoverPhoto,
    getBusinessBySlug,
  };
};
