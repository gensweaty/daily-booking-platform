
import { z } from 'zod';

// Schema for customer data validation
export const customerDataSchema = z.object({
  id: z.string(),
  title: z.string().optional().nullable(),
  user_number: z.string().optional().nullable(),
  social_network_link: z.string().optional().nullable(),
  event_notes: z.string().optional().nullable(),
  payment_status: z.string().optional().nullable(),
  payment_amount: z.number().optional().nullable(),
  created_at: z.string().optional().nullable(),
  updated_at: z.string().optional().nullable(),
  deleted_at: z.string().optional().nullable(),
  user_id: z.string().optional().nullable(),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  customer_files_new: z.array(z.any()).optional().nullable(),
  event_files: z.array(z.any()).optional().nullable()
});
