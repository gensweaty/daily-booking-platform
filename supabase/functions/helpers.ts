
// This function will be used by our edge functions to get booking request files
export const getBookingRequestFiles = async (supabase: any, bookingId: string) => {
  try {
    console.log(`Getting files for booking ID: ${bookingId}`);
    const allFiles = [];
    
    // STEP 1: Check event_files table first (this is where approved booking files end up)
    const { data: eventFilesData, error: eventFilesError } = await supabase
      .from('event_files')
      .select('*')
      .eq('event_id', bookingId);
      
    if (eventFilesError) {
      console.error("Error fetching from event_files:", eventFilesError);
    } else if (eventFilesData && eventFilesData.length > 0) {
      console.log(`Found ${eventFilesData.length} files in event_files`);
      allFiles.push(...eventFilesData.map(file => ({
        ...file,
        source: 'event_files'
      })));
    }
    
    // STEP 2: Check booking_files table if it exists
    try {
      const { data: bookingFilesData, error: bookingFilesError } = await supabase
        .from('booking_files')
        .select('*')
        .eq('booking_request_id', bookingId);
        
      if (!bookingFilesError && bookingFilesData && bookingFilesData.length > 0) {
        console.log(`Found ${bookingFilesData.length} files in booking_files`);
        allFiles.push(...bookingFilesData.map(file => ({
          ...file,
          source: 'booking_files'
        })));
      }
    } catch (e) {
      console.log("booking_files table might not exist, ignoring:", e);
    }
    
    // STEP 3: Fallback - check if the booking request has file metadata directly
    if (allFiles.length === 0) {
      console.log("No files found in dedicated tables, checking booking_requests for file metadata");
      const { data: bookingData, error: bookingError } = await supabase
        .from('booking_requests')
        .select('*')
        .eq('id', bookingId)
        .maybeSingle();
        
      if (bookingError) {
        console.error("Error fetching from booking_requests:", bookingError);
      } else if (bookingData && typeof bookingData === 'object' && 'file_path' in bookingData && bookingData.file_path) {
        console.log("Found file metadata directly in booking_requests:", bookingData.file_path);
        allFiles.push({
          id: `fallback_${bookingId}`,
          booking_request_id: bookingId,
          filename: 'filename' in bookingData && bookingData.filename ? bookingData.filename : 'attachment',
          file_path: bookingData.file_path,
          content_type: 'content_type' in bookingData ? bookingData.content_type || 'application/octet-stream' : 'application/octet-stream',
          size: 'file_size' in bookingData ? Number(bookingData.file_size) || 
                ('size' in bookingData ? Number(bookingData.size) : 0) : 0,
          created_at: new Date().toISOString(),
          source: 'booking_request_direct'
        });
      }
    }

    // STEP 4: Try using get_all_related_files function to find more files
    try {
      console.log("Trying get_all_related_files function for booking:", bookingId);
      const { data: relatedFiles, error: relatedError } = await supabase
        .rpc('get_all_related_files', {
          event_id_param: bookingId,
          customer_id_param: null,
          entity_name_param: null
        });
        
      if (!relatedError && relatedFiles && relatedFiles.length > 0) {
        console.log(`Found ${relatedFiles.length} related files via RPC`);
        // Filter out any duplicates we might already have
        const existingPaths = new Set(allFiles.map(f => f.file_path));
        const uniqueRelatedFiles = relatedFiles.filter(f => !existingPaths.has(f.file_path));
        
        if (uniqueRelatedFiles.length > 0) {
          console.log(`Adding ${uniqueRelatedFiles.length} unique related files`);
          allFiles.push(...uniqueRelatedFiles.map(file => ({
            ...file,
            source: 'related_files_rpc'
          })));
        }
      }
    } catch (e) {
      console.log("Error using get_all_related_files RPC, ignoring:", e);
    }
    
    console.log(`Total files found for booking ID ${bookingId}: ${allFiles.length}`);
    return allFiles;
  } catch (err) {
    console.error("Error in getBookingRequestFiles:", err);
    return [];
  }
};
