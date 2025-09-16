import { supabase } from "@/lib/supabase";

export interface UploadCustomerFilesOptions {
  files: File[];
  customerId: string;
  userId: string;
  isPublicMode?: boolean;
}

/**
 * Upload files to customer_attachments storage and create records in customer_files_new table
 * @param options - Upload configuration including files, customerId, userId, and context
 * @returns Promise that resolves when all files are uploaded
 */
export const uploadCustomerFiles = async (options: UploadCustomerFilesOptions): Promise<void> => {
  const { files, customerId, userId, isPublicMode = false } = options;
  
  if (files.length === 0) return;
  
  console.log(`📤 [${isPublicMode ? 'Public' : 'Internal'}] Uploading ${files.length} files for customer:`, customerId);
  
  const uploadPromises = files.map(async (file) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${customerId}/${Date.now()}.${fileExt}`;
    
    // Upload file to storage
    const { error: uploadError } = await supabase.storage
      .from('customer_attachments')
      .upload(fileName, file);

    if (uploadError) {
      console.error(`❌ [${isPublicMode ? 'Public' : 'Internal'}] Error uploading file:`, uploadError);
      return null;
    }

    // Create record in customer_files_new table
    const { error: dbError } = await supabase
      .from('customer_files_new')
      .insert({
        filename: file.name,
        file_path: fileName,
        content_type: file.type,
        size: file.size,
        user_id: userId, // Always use the provided userId (board owner for public customers)
        customer_id: customerId
      });

    if (dbError) {
      console.error(`❌ [${isPublicMode ? 'Public' : 'Internal'}] Error saving file record:`, dbError);
      return null;
    }

    console.log(`✅ [${isPublicMode ? 'Public' : 'Internal'}] File uploaded successfully:`, file.name);
    return fileName;
  });

  await Promise.all(uploadPromises);
  console.log(`✅ [${isPublicMode ? 'Public' : 'Internal'}] All files uploaded successfully for customer:`, customerId);
};

/**
 * Upload a single file for a customer
 * @param customerId - The customer ID to upload file for
 * @param file - The file to upload
 * @param userId - The user ID to associate with the file
 * @param isPublicMode - Whether this is being called in public mode
 * @returns Promise that resolves to file data
 */
export const uploadSingleCustomerFile = async (
  customerId: string, 
  file: File, 
  userId: string, 
  isPublicMode: boolean = false
) => {
  const fileExt = file.name.split('.').pop();
  const filePath = `${customerId}/${crypto.randomUUID()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('customer_attachments')
    .upload(filePath, file);

  if (uploadError) {
    console.error('Error uploading file:', uploadError);
    throw uploadError;
  }

  const fileData = {
    filename: file.name,
    file_path: filePath,
    content_type: file.type,
    size: file.size,
    user_id: userId,
    customer_id: customerId,
  };

  const { error: fileRecordError } = await supabase
    .from('customer_files_new')
    .insert(fileData);

  if (fileRecordError) {
    console.error('Error creating file record:', fileRecordError);
    throw fileRecordError;
  }

  return fileData;
};

/**
 * Load existing files for a customer from the customer_files_new table
 * @param customerId - The customer ID to load files for
 * @returns Promise that resolves to an array of file records
 */
export const loadCustomerFiles = async (customerId: string) => {
  try {
    console.log('🔍 Loading existing files for customer:', customerId);

    const { data: customerFiles, error } = await supabase
      .from('customer_files_new')
      .select('*')
      .eq('customer_id', customerId);

    if (error) {
      console.error('❌ Error loading customer files:', error);
      return [];
    }

    console.log('✅ Loaded existing files:', customerFiles?.length || 0, 'files for customer:', customerId);
    return customerFiles || [];
  } catch (error) {
    console.error('❌ Error loading existing files:', error);
    return [];
  }
};