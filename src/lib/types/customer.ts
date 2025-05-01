
export interface Customer {
  id: string;
  fullName: string;
  phoneNumber?: string;
  socialLink?: string;
  paymentStatus?: 'not_paid' | 'paid_partly' | 'paid_fully';
  paymentAmount?: number;
  comments?: string;
  createdAt?: string;
  user_id?: string;
  user_surname?: string;
  user_number?: string;
  social_network_link?: string;
  payment_status?: string;
  payment_amount?: number;
  event_notes?: string;
  created_at?: string;
  customer_files_new?: any[];
}
