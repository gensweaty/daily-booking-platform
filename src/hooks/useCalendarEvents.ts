
const getBusinessEvents = async () => {
  if (!businessId && !businessUserId) {
    return [];
  }
  
  let targetUserId = businessUserId;
  
  if (businessId && !targetUserId) {
    try {
      console.log("Fetching business user ID for business:", businessId);
      
      const { data: businessProfile, error: businessError } = await supabase
        .from("business_profiles")
        .select("user_id")
        .eq("id", businessId)
        .single();
        
      if (businessError) {
        console.error("Error fetching business profile:", businessError);
        return [];
      }
      
      if (!businessProfile?.user_id) {
        console.error("No user_id found for business:", businessId);
        return [];
      }
      
      targetUserId = businessProfile.user_id;
      console.log("Found user_id for business:", targetUserId);
    } catch (error) {
      console.error("Error fetching business profile:", error);
      return [];
    }
  }
  
  if (!targetUserId) {
    console.error("No target user ID found to fetch business events");
    return [];
  }
  
  try {
    console.log("Fetching business events for user ID:", targetUserId);
    
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', targetUserId)
      .order('start_date', { ascending: true });

    if (error) {
      console.error("Error fetching business events:", error);
      return [];
    }
    
    console.log("Fetched business events:", data?.length || 0);
    return data || [];
  } catch (error) {
    console.error("Error fetching business events:", error);
    return [];
  }
};
