
// This function will be used by our edge functions to get booking request files
export const getBookingRequestFiles = async (supabase: any, bookingId: string) => {
  try {
    console.log(`Getting files for booking ID: ${bookingId}`);
    const allFiles = [];
    const processedPaths = new Set(); // To avoid duplicate files
    
    // STEP 1: Check event_files table first (this is where approved booking files end up)
    const { data: eventFilesData, error: eventFilesError } = await supabase
      .from('event_files')
      .select('*')
      .eq('event_id', bookingId);
      
    if (eventFilesError) {
      console.error("Error fetching from event_files:", eventFilesError);
    } else if (eventFilesData && eventFilesData.length > 0) {
      console.log(`Found ${eventFilesData.length} files in event_files`);
      for (const file of eventFilesData) {
        if (file.file_path && !processedPaths.has(file.file_path)) {
          allFiles.push({
            ...file,
            source: 'event_files'
          });
          processedPaths.add(file.file_path);
        }
      }
    }
    
    // STEP 2: Check booking_files table if it exists
    try {
      const { data: bookingFilesData, error: bookingFilesError } = await supabase
        .from('booking_files')
        .select('*')
        .eq('booking_request_id', bookingId);
        
      if (!bookingFilesError && bookingFilesData && bookingFilesData.length > 0) {
        console.log(`Found ${bookingFilesData.length} files in booking_files`);
        for (const file of bookingFilesData) {
          if (file.file_path && !processedPaths.has(file.file_path)) {
            allFiles.push({
              ...file,
              source: 'booking_files'
            });
            processedPaths.add(file.file_path);
          }
        }
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
        
        // Safe type checking for each property
        const filename = 'filename' in bookingData && typeof bookingData.filename === 'string' 
          ? bookingData.filename 
          : 'attachment';
          
        const contentType = 'content_type' in bookingData && typeof bookingData.content_type === 'string' 
          ? bookingData.content_type 
          : 'application/octet-stream';
          
        let fileSize = 0;
        if ('file_size' in bookingData && typeof bookingData.file_size === 'number') {
          fileSize = bookingData.file_size;
        } else if ('size' in bookingData && typeof bookingData.size === 'number') {
          fileSize = bookingData.size;
        }
        
        if (!processedPaths.has(bookingData.file_path)) {
          allFiles.push({
            id: `fallback_${bookingId}`,
            booking_request_id: bookingId,
            filename: filename,
            file_path: bookingData.file_path,
            content_type: contentType,
            size: fileSize,
            created_at: new Date().toISOString(),
            source: 'booking_request_direct'
          });
          processedPaths.add(bookingData.file_path);
        }
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
        for (const file of relatedFiles) {
          if (file.file_path && !processedPaths.has(file.file_path)) {
            allFiles.push({
              ...file,
              source: 'related_files_rpc'
            });
            processedPaths.add(file.file_path);
          }
        }
      }
    } catch (e) {
      console.log("Error using get_all_related_files RPC, ignoring:", e);
    }
    
    // STEP 5: Check storage bucket directly
    try {
      console.log("Checking storage bucket directly for files that might be linked to this booking");
      const { data: bucketFiles, error: bucketError } = await supabase.storage
        .from('event_attachments')
        .list(bookingId);
        
      if (!bucketError && bucketFiles && bucketFiles.length > 0) {
        console.log(`Found ${bucketFiles.length} files in storage bucket with prefix ${bookingId}`);
        
        for (const file of bucketFiles) {
          if (!file.name || file.name === '.emptyFolderPlaceholder') continue;
          
          const filePath = `${bookingId}/${file.name}`;
          if (!processedPaths.has(filePath)) {
            allFiles.push({
              id: `storage_${bookingId}_${file.name}`,
              booking_request_id: bookingId,
              filename: file.name,
              file_path: filePath,
              content_type: guessContentType(file.name),
              size: file.metadata?.size || 0,
              created_at: new Date().toISOString(),
              source: 'storage_bucket'
            });
            processedPaths.add(filePath);
          }
        }
      }
    } catch (bucketErr) {
      console.log("Error checking storage bucket, ignoring:", bucketErr);
    }
    
    console.log(`Total files found for booking ID ${bookingId}: ${allFiles.length}`);
    return allFiles;
  } catch (err) {
    console.error("Error in getBookingRequestFiles:", err);
    return [];
  }
};

// Helper function to guess content type from filename
function guessContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (!ext) return 'application/octet-stream';
  
  const mimeTypes: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'txt': 'text/plain',
    'csv': 'text/csv',
    'json': 'application/json',
    'mp4': 'video/mp4',
    'mp3': 'audio/mpeg'
  };
  
  return mimeTypes[ext] || 'application/octet-stream';
}
