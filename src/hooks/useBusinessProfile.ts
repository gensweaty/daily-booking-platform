
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { BusinessProfile } from "@/types/database";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";

export const useBusinessProfile = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  const getBusinessProfile = async (): Promise<BusinessProfile | null> => {
    if (!user) return null;
    
    const { data, error } = await supabase
      .from("business_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;
    return data;
  };

  const createBusinessProfile = async (profile: Omit<BusinessProfile, "id" | "created_at" | "updated_at" | "user_id">): Promise<BusinessProfile> => {
    if (!user) throw new Error("User must be authenticated to create a business profile");
    
    const { data, error } = await supabase
      .from("business_profiles")
      .insert([{ ...profile, user_id: user.id }])
      .select()
      .single();

    if (error) throw error;
    return data;
  };

  const updateBusinessProfile = async (updates: Partial<BusinessProfile>): Promise<BusinessProfile> => {
    if (!user || !businessProfile) throw new Error("User must be authenticated and have a business profile to update it");
    
    const { data, error } = await supabase
      .from("business_profiles")
      .update(updates)
      .eq("id", businessProfile.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  };

  // New function to upload cover photo
  const uploadCoverPhoto = async (file: File) => {
    if (!user) throw new Error("User must be authenticated to upload a cover photo");
    
    try {
      // Check if storage bucket exists, if not create it
      const { data: buckets } = await supabase.storage.listBuckets();
      const businessBucketExists = buckets?.some(b => b.name === 'business_covers');
      
      if (!businessBucketExists) {
        await supabase.storage.createBucket('business_covers', {
          public: true,
          allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
          fileSizeLimit: 5000000 // 5MB
        });
      }

      // Generate a unique file name
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}_cover_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      // Upload the file
      const { error: uploadError } = await supabase.storage
        .from('business_covers')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get the public URL
      const { data } = supabase.storage
        .from('business_covers')
        .getPublicUrl(filePath);

      return { url: data.publicUrl };
    } catch (error: any) {
      toast({
        title: "Upload Error",
        description: error.message || "Failed to upload image",
        variant: "destructive",
      });
      return { url: null };
    }
  };

  const { data: businessProfile, isLoading, error } = useQuery({
    queryKey: ["businessProfile", user?.id],
    queryFn: getBusinessProfile,
    enabled: !!user,
  });

  const createProfileMutation = useMutation({
    mutationFn: createBusinessProfile,
    onSuccess: (newProfile) => {
      queryClient.invalidateQueries({ queryKey: ["businessProfile", user?.id] });
      toast({
        title: "Success",
        description: "Business profile created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create business profile",
        variant: "destructive",
      });
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: updateBusinessProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["businessProfile", user?.id] });
      toast({
        title: "Success",
        description: "Business profile updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update business profile",
        variant: "destructive",
      });
    },
  });

  const generateSlug = (businessName: string) => {
    return businessName
      .toLowerCase()
      .replace(/[^\w\s]/gi, "")
      .replace(/\s+/g, "-");
  };

  return {
    businessProfile,
    isLoading,
    error,
    createBusinessProfile: createProfileMutation.mutate,
    updateBusinessProfile: updateProfileMutation.mutate,
    generateSlug,
    uploadCoverPhoto,
  };
};
