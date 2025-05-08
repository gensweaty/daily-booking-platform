
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { customerDataSchema } from "./schemas";
import { startOfDay } from "date-fns";

export const useCRMData = (
  userId: string | undefined,
  dateRange?: { start: Date; end: Date }
) => {
  const { data: customersData, isLoading, error, isFetching } = useQuery({
    queryKey: ['crm', userId, dateRange?.start?.toString(), dateRange?.end?.toString()],
    queryFn: async () => {
      if (!userId) return [];

      let query = supabase
        .from('customers')
        .select('*')
        .eq('user_id', userId);

      if (dateRange) {
        const startDate = startOfDay(dateRange.start).toISOString();
        const endDate = startOfDay(dateRange.end).toISOString();

        query = query
          .gte('created_at', startDate)
          .lte('created_at', endDate);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching customers:", error);
        throw error;
      }

      // Validate data against the schema
      const validCustomers = data?.map(customer => {
        const result = customerDataSchema.safeParse(customer);
        if (!result.success) {
          console.error("Validation error for customer:", customer, result.error);
          return null;
        }
        return result.data;
      }).filter(Boolean) as any[];

      return validCustomers;
    },
    enabled: !!userId,
    staleTime: 60000, // 1 minute
  });

  const combinedData = customersData || [];

  return {
    combinedData,
    isLoading,
    isFetching,
    error,
  };
};
