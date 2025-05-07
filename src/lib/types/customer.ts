
import { FileRecord } from "@/types/files";

export interface Customer {
  id: string;
  title: string;
  user_surname?: string;
  user_number?: string;
  social_network_link?: string;
  customer_notes?: string;
  create_event?: boolean;
  payment_status?: string;
  payment_amount?: number | null;
  start_date?: string;
  end_date?: string;
  type?: string;
  user_id?: string;
  created_at?: string;
  deleted_at?: string;
  customer_files_new?: FileRecord[];
}
