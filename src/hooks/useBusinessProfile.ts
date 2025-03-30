import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { BusinessProfile } from "@/types/database";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";

export const useBusinessProfile = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  const mapProfileFields = (profile: any): BusinessProfile => {
    return {
      ...profile,
      business_description: profile.description || profile.business_description || '',
      business_address: profile.contact_address || profile.business_address || '',
      business_phone: profile.contact_phone || profile.business_phone || '',
      business_email: profile.contact_email || profile.business_email || '',
      business_website: profile.contact_website || profile.business_website || '',
      business_logo: profile.cover_photo_url || profile.business_logo || '',
      description: profile.description || profile.business_description || '',
      contact_address: profile.contact_address || profile.business_address || '',
      contact_phone: profile.contact_phone || profile.business_phone || '',
      contact_email: profile.contact_email || profile.business_email || '',
      contact_website: profile.contact_website || profile.business_website || '',
      cover_photo_url: profile.cover_photo_url || profile.business_logo || ''
    };
  };

  const getBusinessProfile = async (): Promise<BusinessProfile | null> => {
    if (!user) return null;
    
    const { data, error } = await supabase
      .from("business_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;
    return data ? mapProfileFields(data) : null;
  };

  const createBusinessProfile = async (profile: Partial<BusinessProfile>): Promise<BusinessProfile> => {
    if (!user) throw new Error("User must be authenticated to create a business profile");
    
    const preparedProfile = {
      business_name: profile.business_name || '',
      business_description: profile.description || '',
      business_address: profile.contact_address || '',
      business_phone: profile.contact_phone || '',
      business_email: profile.contact_email || '',
      business_website: profile.contact_website || '',
      business_logo: profile.cover_photo_url || '',
      slug: profile.slug || '',
      user_id: user.id
    };
    
    const { data, error } = await supabase
      .from("business_profiles")
      .insert([preparedProfile])
      .select()
      .single();

    if (error) throw error;
    return mapProfileFields(data);
  };

  const updateBusinessProfile = async (updates: Partial<BusinessProfile>): Promise<BusinessProfile> => {
    if (!user || !businessProfile) throw new Error("User must be authenticated and have a business profile to update it");
    
    const preparedUpdates: any = {};
    
    if (updates.business_name) preparedUpdates.business_name = updates.business_name;
    if (updates.description) {
      preparedUpdates.business_description = updates.description;
      preparedUpdates.description = updates.description;
    }
    if (updates.contact_address) {
      preparedUpdates.business_address = updates.contact_address;
      preparedUpdates.contact_address = updates.contact_address;
    }
    if (updates.contact_phone) {
      preparedUpdates.business_phone = updates.contact_phone;
      preparedUpdates.contact_phone = updates.contact_phone;
    }
    if (updates.contact_email) {
      preparedUpdates.business_email = updates.contact_email;
      preparedUpdates.contact_email = updates.contact_email;
    }
    if (updates.contact_website) {
      preparedUpdates.business_website = updates.contact_website;
      preparedUpdates.contact_website = updates.contact_website;
    }
    if (updates.cover_photo_url) {
      preparedUpdates.business_logo = updates.cover_photo_url;
      preparedUpdates.cover_photo_url = updates.cover_photo_url;
    }
    if (updates.slug) preparedUpdates.slug = updates.slug;
    
    const { data, error } = await supabase
      .from("business_profiles")
      .update(preparedUpdates)
      .eq("id", businessProfile.id)
      .select()
      .single();

    if (error) throw error;
    return mapProfileFields(data);
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
  };
};
