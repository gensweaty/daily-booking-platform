/**
 * Utility for fetching all records from Supabase when there are more than 1000 rows.
 * Supabase PostgREST has a server-side max_rows limit of 1000 that cannot be overridden
 * by client-side .range() or .limit() calls. This utility fetches in batches.
 */

const BATCH_SIZE = 1000;

/**
 * Fetches all records from a Supabase table by paginating through batches of 1000.
 * @param fetchBatch - Function that takes offset and limit and returns data for that range
 * @returns All records combined from all batches
 */
export async function fetchAllRecords<T>(
  fetchBatch: (from: number, to: number) => Promise<{ data: T[] | null; error: any }>
): Promise<T[]> {
  const allData: T[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await fetchBatch(offset, offset + BATCH_SIZE - 1);
    
    if (error) {
      console.error('Error fetching batch at offset', offset, ':', error);
      throw error;
    }

    const batchData = data || [];
    allData.push(...batchData);
    
    console.log(`Fetched batch: offset=${offset}, count=${batchData.length}, total=${allData.length}`);
    
    // If we got fewer records than the batch size, we've reached the end
    hasMore = batchData.length === BATCH_SIZE;
    offset += BATCH_SIZE;
  }

  return allData;
}

/**
 * Helper to create a paginated fetch function for customers table
 */
export function createCustomersPaginatedFetch(
  supabase: any,
  userId: string,
  startDateStr: string,
  endDateStr: string,
  additionalFilters?: (query: any) => any
) {
  return async (from: number, to: number) => {
    let query = supabase
      .from('customers')
      .select(`*, customer_files_new(*)`)
      .eq('user_id', userId)
      .gte('created_at', startDateStr)
      .lte('created_at', endDateStr)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (additionalFilters) {
      query = additionalFilters(query);
    }

    return query;
  };
}

/**
 * Helper to create a paginated fetch function for events table
 */
export function createEventsPaginatedFetch(
  supabase: any,
  userId: string,
  startDateStr: string,
  endDateStr: string,
  dateField: 'created_at' | 'start_date' = 'created_at'
) {
  return async (from: number, to: number) => {
    return supabase
      .from('events')
      .select('*')
      .eq('user_id', userId)
      .gte(dateField, startDateStr)
      .lte(dateField, endDateStr)
      .is('deleted_at', null)
      .is('parent_event_id', null)
      .order('created_at', { ascending: false })
      .range(from, to);
  };
}
