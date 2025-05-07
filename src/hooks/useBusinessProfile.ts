import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, forceBucketCreation } from "@/lib/supabase";
import { BusinessProfile } from "@/types/database";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";

export const useBusinessProfile = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  // Helper function to normalize slugs consistently
  const normalizeSlug = (slug: string): string => {
    return slug.toLowerCase().trim();
  };

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
    
    // Normalize the slug for consistency
    const normalizedProfile = {
      ...profile,
      slug: normalizeSlug(profile.slug)
    };
    
    // Verify slug uniqueness
    const { data: existingProfile, error: checkError } = await supabase
      .from("business_profiles")
      .select("id")
      .eq("slug", normalizedProfile.slug)
      .maybeSingle();
      
    if (checkError) throw checkError;
    
    if (existingProfile && existingProfile.id) {
      throw new Error("A business with this URL slug already exists. Please choose a different slug.");
    }
    
    try {
      const { data, error } = await supabase
        .from("business_profiles")
        .insert([{ ...normalizedProfile, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error("Error in createBusinessProfile:", error);
      throw error;
    }
  };

  const updateBusinessProfile = async (updates: Partial<BusinessProfile>): Promise<BusinessProfile> => {
    if (!user || !businessProfile) throw new Error("User must be authenticated and have a business profile to update it");
    
    let normalizedUpdates = { ...updates };
    
    // If slug is being updated, normalize it
    if (updates.slug) {
      normalizedUpdates.slug = normalizeSlug(updates.slug);
      
      // Check if this slug already exists for another business
      const { data: existingProfile, error: checkError } = await supabase
        .from("business_profiles")
        .select("id")
        .eq("slug", normalizedUpdates.slug)
        .neq("id", businessProfile.id) // Exclude current business
        .maybeSingle();
        
      if (checkError) throw checkError;
      
      if (existingProfile && existingProfile.id) {
        throw new Error("A business with this URL slug already exists. Please choose a different slug.");
      }
    }
    
    try {
      console.log("Updating business profile:", normalizedUpdates);
      
      const { data, error } = await supabase
        .from("business_profiles")
        .update(normalizedUpdates)
        .eq("id", businessProfile.id)
        .select()
        .single();

      if (error) throw error;
      
      // Force a cache invalidation with a slight delay to ensure it's picked up
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["businessProfile", user?.id] });
      }, 500);
      
      return data;
    } catch (error: any) {
      console.error("Error in updateBusinessProfile:", error);
      throw error;
    }
  };

  const uploadCoverPhoto = async (file: File) => {
    if (!user) throw new Error("User must be authenticated to upload a cover photo");
    
    try {
      console.log("Starting cover photo upload process...");
      
      // Force bucket verification before upload
      await forceBucketCreation();
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}_${Date.now()}.${fileExt}`;
      const filePath = fileName;

      console.log(`Uploading file: ${filePath} (Size: ${(file.size / 1024 / 1024).toFixed(2)}MB)`);
      
      // Remove old cover photo if it exists
      if (businessProfile?.cover_photo_url) {
        try {
          const oldUrl = new URL(businessProfile.cover_photo_url);
          const pathSegments = oldUrl.pathname.split('/');
          const oldFileName = pathSegments[pathSegments.length - 1];
          
          if (oldFileName) {
            console.log(`Attempting to remove old file: ${oldFileName}`);
            const { error: removeError } = await supabase.storage
              .from('business_covers')
              .remove([oldFileName]);
              
            if (removeError) {
              console.warn("Could not remove old file, continuing anyway:", removeError);
            } else {
              console.log("Old file removed successfully");
            }
          }
        } catch (e) {
          console.warn("Error parsing old file URL, skipping removal:", e);
        }
      }
      
      // Upload the new file with retries if needed
      let uploadAttempts = 0;
      let uploadSuccess = false;
      let uploadData;
      let uploadError;
      
      while (uploadAttempts < 3 && !uploadSuccess) {
        uploadAttempts++;
        
        // Wait a bit before retrying
        if (uploadAttempts > 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          console.log(`Retry attempt ${uploadAttempts} for file upload`);
        }
        
        // Log the upload attempt details
        console.log(`Upload attempt ${uploadAttempts} - File size: ${file.size} bytes, File type: ${file.type}`);
        
        const { error, data } = await supabase.storage
          .from('business_covers')
          .upload(filePath, file, {
            cacheControl: 'no-cache',
            upsert: true
          });
        
        if (error) {
          console.error(`Upload attempt ${uploadAttempts} failed:`, error);
          uploadError = error;
        } else {
          console.log(`Upload successful on attempt ${uploadAttempts}:`, data);
          uploadSuccess = true;
          uploadData = data;
        }
      }
      
      if (!uploadSuccess) {
        throw uploadError || new Error("Failed to upload file after multiple attempts");
      }

      console.log("File uploaded successfully:", uploadData);

      // Get the public URL with a timestamp to prevent caching
      const { data } = supabase.storage
        .from('business_covers')
        .getPublicUrl(filePath);

      const publicUrl = `${data.publicUrl}?t=${Date.now()}`;
      
      console.log("Generated public URL with cache-busting:", publicUrl);

      if (businessProfile) {
        console.log("Updating business profile with new cover photo URL");
        
        const { error: updateError } = await supabase
          .from("business_profiles")
          .update({ 
            cover_photo_url: publicUrl,
            updated_at: new Date().toISOString() // Force an update to the timestamp
          })
          .eq("id", businessProfile.id);
          
        if (updateError) {
          console.error("Error updating business profile:", updateError);
          toast({
            title: "Update Error",
            description: "Failed to update profile with new cover photo",
            variant: "destructive",
          });
        } else {
          // Invalidate the query to refresh the data
          await queryClient.invalidateQueries({ queryKey: ["businessProfile", user?.id] });
          
          // Add a delayed second invalidation to ensure the updated cover photo URL is loaded
          setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ["businessProfile", user?.id] });
          }, 1000);
        }
      }

      return { url: publicUrl };
    } catch (error: any) {
      console.error("Cover photo upload error:", error);
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
    staleTime: 30000, // Consider data fresh for 30 seconds
    refetchInterval: 60000, // Refetch every minute
    refetchOnWindowFocus: true,
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
      .replace(/\s+/g, "-")
      .trim();
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
