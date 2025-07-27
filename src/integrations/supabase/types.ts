export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      booking_files: {
        Row: {
          booking_request_id: string | null
          content_type: string | null
          created_at: string | null
          file_path: string
          filename: string
          id: string
          size: number | null
          user_id: string | null
        }
        Insert: {
          booking_request_id?: string | null
          content_type?: string | null
          created_at?: string | null
          file_path: string
          filename: string
          id?: string
          size?: number | null
          user_id?: string | null
        }
        Update: {
          booking_request_id?: string | null
          content_type?: string | null
          created_at?: string | null
          file_path?: string
          filename?: string
          id?: string
          size?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_files_booking_request_id_fkey"
            columns: ["booking_request_id"]
            isOneToOne: false
            referencedRelation: "booking_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_requests: {
        Row: {
          business_id: string
          created_at: string | null
          deleted_at: string | null
          description: string | null
          end_date: string
          id: string
          language: string | null
          payment_amount: number | null
          payment_status: string | null
          requester_email: string
          requester_name: string
          requester_phone: string | null
          start_date: string
          status: string
          title: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          business_id: string
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          end_date: string
          id?: string
          language?: string | null
          payment_amount?: number | null
          payment_status?: string | null
          requester_email: string
          requester_name: string
          requester_phone?: string | null
          start_date: string
          status?: string
          title: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          end_date?: string
          id?: string
          language?: string | null
          payment_amount?: number | null
          payment_status?: string | null
          requester_email?: string
          requester_name?: string
          requester_phone?: string | null
          start_date?: string
          status?: string
          title?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_requests_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      business_profiles: {
        Row: {
          business_name: string
          contact_address: string | null
          contact_email: string | null
          contact_phone: string | null
          contact_website: string | null
          cover_photo_url: string | null
          created_at: string | null
          description: string | null
          id: string
          slug: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          business_name: string
          contact_address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          contact_website?: string | null
          cover_photo_url?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          slug: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          business_name?: string
          contact_address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          contact_website?: string | null
          cover_photo_url?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          slug?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      businesses: {
        Row: {
          contact_address: string | null
          contact_email: string | null
          contact_phone: string | null
          contact_website: string | null
          cover_photo_path: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
          updated_at: string
          user_id: string
        }
        Insert: {
          contact_address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          contact_website?: string | null
          cover_photo_path?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
          updated_at?: string
          user_id: string
        }
        Update: {
          contact_address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          contact_website?: string | null
          cover_photo_path?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      checkout_sessions: {
        Row: {
          amount_total: number | null
          attrs: Json | null
          created_at: string | null
          currency: string | null
          customer: string | null
          id: string
          payment_intent: string | null
          payment_status: string | null
          status: string | null
          subscription: string | null
          user_id: string | null
        }
        Insert: {
          amount_total?: number | null
          attrs?: Json | null
          created_at?: string | null
          currency?: string | null
          customer?: string | null
          id: string
          payment_intent?: string | null
          payment_status?: string | null
          status?: string | null
          subscription?: string | null
          user_id?: string | null
        }
        Update: {
          amount_total?: number | null
          attrs?: Json | null
          created_at?: string | null
          currency?: string | null
          customer?: string | null
          id?: string
          payment_intent?: string | null
          payment_status?: string | null
          status?: string | null
          subscription?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      customer_files: {
        Row: {
          content_type: string | null
          created_at: string | null
          customer_id: string | null
          file_path: string
          filename: string
          id: string
          size: number | null
          user_id: string | null
        }
        Insert: {
          content_type?: string | null
          created_at?: string | null
          customer_id?: string | null
          file_path: string
          filename: string
          id?: string
          size?: number | null
          user_id?: string | null
        }
        Update: {
          content_type?: string | null
          created_at?: string | null
          customer_id?: string | null
          file_path?: string
          filename?: string
          id?: string
          size?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_files_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_files_new: {
        Row: {
          content_type: string | null
          created_at: string | null
          customer_id: string | null
          file_path: string
          filename: string
          id: string
          size: number | null
          user_id: string | null
        }
        Insert: {
          content_type?: string | null
          created_at?: string | null
          customer_id?: string | null
          file_path: string
          filename: string
          id?: string
          size?: number | null
          user_id?: string | null
        }
        Update: {
          content_type?: string | null
          created_at?: string | null
          customer_id?: string | null
          file_path?: string
          filename?: string
          id?: string
          size?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_files_new_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          create_event: boolean | null
          created_at: string | null
          deleted_at: string | null
          end_date: string | null
          event_id: string | null
          event_notes: string | null
          id: string
          is_group_member: boolean | null
          parent_group_id: string | null
          payment_amount: number | null
          payment_status: string | null
          social_network_link: string | null
          start_date: string | null
          title: string
          type: string | null
          user_id: string | null
          user_number: string | null
          user_surname: string | null
        }
        Insert: {
          create_event?: boolean | null
          created_at?: string | null
          deleted_at?: string | null
          end_date?: string | null
          event_id?: string | null
          event_notes?: string | null
          id?: string
          is_group_member?: boolean | null
          parent_group_id?: string | null
          payment_amount?: number | null
          payment_status?: string | null
          social_network_link?: string | null
          start_date?: string | null
          title: string
          type?: string | null
          user_id?: string | null
          user_number?: string | null
          user_surname?: string | null
        }
        Update: {
          create_event?: boolean | null
          created_at?: string | null
          deleted_at?: string | null
          end_date?: string | null
          event_id?: string | null
          event_notes?: string | null
          id?: string
          is_group_member?: boolean | null
          parent_group_id?: string | null
          payment_amount?: number | null
          payment_status?: string | null
          social_network_link?: string | null
          start_date?: string | null
          title?: string
          type?: string | null
          user_id?: string | null
          user_number?: string | null
          user_surname?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_customers_event_id"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_files: {
        Row: {
          content_type: string | null
          created_at: string | null
          event_id: string | null
          file_path: string
          filename: string
          id: string
          size: number | null
          user_id: string | null
        }
        Insert: {
          content_type?: string | null
          created_at?: string | null
          event_id?: string | null
          file_path: string
          filename: string
          id?: string
          size?: number | null
          user_id?: string | null
        }
        Update: {
          content_type?: string | null
          created_at?: string | null
          event_id?: string | null
          file_path?: string
          filename?: string
          id?: string
          size?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      event_requests: {
        Row: {
          business_id: string
          created_at: string
          end_date: string
          event_notes: string | null
          id: string
          payment_amount: number | null
          payment_status: string | null
          social_network_link: string | null
          start_date: string
          status: string
          title: string
          type: string | null
          updated_at: string
          user_number: string | null
          user_surname: string | null
        }
        Insert: {
          business_id: string
          created_at?: string
          end_date: string
          event_notes?: string | null
          id?: string
          payment_amount?: number | null
          payment_status?: string | null
          social_network_link?: string | null
          start_date: string
          status?: string
          title: string
          type?: string | null
          updated_at?: string
          user_number?: string | null
          user_surname?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string
          end_date?: string
          event_notes?: string | null
          id?: string
          payment_amount?: number | null
          payment_status?: string | null
          social_network_link?: string | null
          start_date?: string
          status?: string
          title?: string
          type?: string | null
          updated_at?: string
          user_number?: string | null
          user_surname?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_requests_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          booking_request_id: string | null
          content_type: string | null
          created_at: string | null
          deleted_at: string | null
          end_date: string
          event_name: string | null
          event_notes: string | null
          file_path: string | null
          file_size: number | null
          filename: string | null
          group_member_count: number | null
          group_name: string | null
          id: string
          is_group_event: boolean | null
          is_recurring: boolean | null
          language: string | null
          original_booking_id: string | null
          parent_event_id: string | null
          parent_group_id: string | null
          payment_amount: number | null
          payment_status: string | null
          recurrence_instance_date: string | null
          repeat_pattern: string | null
          repeat_until: string | null
          size: number | null
          social_network_link: string | null
          start_date: string
          title: string
          type: string | null
          user_id: string | null
          user_number: string | null
          user_surname: string | null
        }
        Insert: {
          booking_request_id?: string | null
          content_type?: string | null
          created_at?: string | null
          deleted_at?: string | null
          end_date: string
          event_name?: string | null
          event_notes?: string | null
          file_path?: string | null
          file_size?: number | null
          filename?: string | null
          group_member_count?: number | null
          group_name?: string | null
          id?: string
          is_group_event?: boolean | null
          is_recurring?: boolean | null
          language?: string | null
          original_booking_id?: string | null
          parent_event_id?: string | null
          parent_group_id?: string | null
          payment_amount?: number | null
          payment_status?: string | null
          recurrence_instance_date?: string | null
          repeat_pattern?: string | null
          repeat_until?: string | null
          size?: number | null
          social_network_link?: string | null
          start_date: string
          title: string
          type?: string | null
          user_id?: string | null
          user_number?: string | null
          user_surname?: string | null
        }
        Update: {
          booking_request_id?: string | null
          content_type?: string | null
          created_at?: string | null
          deleted_at?: string | null
          end_date?: string
          event_name?: string | null
          event_notes?: string | null
          file_path?: string | null
          file_size?: number | null
          filename?: string | null
          group_member_count?: number | null
          group_name?: string | null
          id?: string
          is_group_event?: boolean | null
          is_recurring?: boolean | null
          language?: string | null
          original_booking_id?: string | null
          parent_event_id?: string | null
          parent_group_id?: string | null
          payment_amount?: number | null
          payment_status?: string | null
          recurrence_instance_date?: string | null
          repeat_pattern?: string | null
          repeat_until?: string | null
          size?: number | null
          social_network_link?: string | null
          start_date?: string
          title?: string
          type?: string | null
          user_id?: string | null
          user_number?: string | null
          user_surname?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_parent_event_id_fkey"
            columns: ["parent_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_parent_group_id_fkey"
            columns: ["parent_group_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          content_type: string | null
          created_at: string | null
          file_path: string
          filename: string
          id: string
          parent_type: string | null
          size: number | null
          source: string | null
          task_id: string | null
          user_id: string | null
        }
        Insert: {
          content_type?: string | null
          created_at?: string | null
          file_path: string
          filename: string
          id?: string
          parent_type?: string | null
          size?: number | null
          source?: string | null
          task_id?: string | null
          user_id?: string | null
        }
        Update: {
          content_type?: string | null
          created_at?: string | null
          file_path?: string
          filename?: string
          id?: string
          parent_type?: string | null
          size?: number | null
          source?: string | null
          task_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "files_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      note_files: {
        Row: {
          content_type: string | null
          created_at: string | null
          file_path: string
          filename: string
          id: string
          note_id: string | null
          size: number | null
          user_id: string | null
        }
        Insert: {
          content_type?: string | null
          created_at?: string | null
          file_path: string
          filename: string
          id?: string
          note_id?: string | null
          size?: number | null
          user_id?: string | null
        }
        Update: {
          content_type?: string | null
          created_at?: string | null
          file_path?: string
          filename?: string
          id?: string
          note_id?: string | null
          size?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "note_files_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          color: string | null
          content: string | null
          created_at: string | null
          id: string
          title: string
          user_id: string | null
        }
        Insert: {
          color?: string | null
          content?: string | null
          created_at?: string | null
          id?: string
          title: string
          user_id?: string | null
        }
        Update: {
          color?: string | null
          content?: string | null
          created_at?: string | null
          id?: string
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          id: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          id: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          id?: string
          username?: string
        }
        Relationships: []
      }
      redeem_codes: {
        Row: {
          code: string
          created_at: string | null
          id: string
          is_used: boolean | null
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          is_used?: boolean | null
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          is_used?: boolean | null
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      reminders: {
        Row: {
          created_at: string
          description: string | null
          id: string
          remind_at: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          remind_at: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          remind_at?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      "Stripe cusotmers": {
        Row: {
          created_at: string
          id: number
        }
        Insert: {
          created_at?: string
          id?: number
        }
        Update: {
          created_at?: string
          id?: number
        }
        Relationships: []
      }
      stripe_webhook_events: {
        Row: {
          created_at: string | null
          data: Json | null
          id: string
          object_id: string | null
          object_type: string | null
          processed: boolean | null
          processing_error: string | null
          type: string
        }
        Insert: {
          created_at?: string | null
          data?: Json | null
          id: string
          object_id?: string | null
          object_type?: string | null
          processed?: boolean | null
          processing_error?: string | null
          type: string
        }
        Update: {
          created_at?: string | null
          data?: Json | null
          id?: string
          object_id?: string | null
          object_type?: string | null
          processed?: boolean | null
          processing_error?: string | null
          type?: string
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          price: number
          type: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          price: number
          type: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          price?: number
          type?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          attrs: Json | null
          created_at: string | null
          currency: string | null
          current_period_end: string | null
          current_period_start: string | null
          email: string | null
          id: string
          last_payment_id: string | null
          plan_id: string | null
          plan_type: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_end_date: string | null
          subscription_start_date: string | null
          trial_end_date: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          attrs?: Json | null
          created_at?: string | null
          currency?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          email?: string | null
          id?: string
          last_payment_id?: string | null
          plan_id?: string | null
          plan_type: string
          status: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_end_date?: string | null
          subscription_start_date?: string | null
          trial_end_date?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          attrs?: Json | null
          created_at?: string | null
          currency?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          email?: string | null
          id?: string
          last_payment_id?: string | null
          plan_id?: string | null
          plan_type?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_end_date?: string | null
          subscription_start_date?: string | null
          trial_end_date?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          archived: boolean | null
          archived_at: string | null
          created_at: string | null
          deadline_at: string | null
          description: string | null
          email_reminder: boolean | null
          id: string
          position: number | null
          reminder_at: string | null
          status: string
          title: string
          user_id: string | null
        }
        Insert: {
          archived?: boolean | null
          archived_at?: string | null
          created_at?: string | null
          deadline_at?: string | null
          description?: string | null
          email_reminder?: boolean | null
          id?: string
          position?: number | null
          reminder_at?: string | null
          status?: string
          title: string
          user_id?: string | null
        }
        Update: {
          archived?: boolean | null
          archived_at?: string | null
          created_at?: string | null
          deadline_at?: string | null
          description?: string | null
          email_reminder?: boolean | null
          id?: string
          position?: number | null
          reminder_at?: string | null
          status?: string
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_subscription: {
        Args: { p_user_id: string; p_subscription_type: string }
        Returns: Json
      }
      check_and_lock_redeem_code: {
        Args: { p_code: string }
        Returns: {
          is_valid: boolean
          code_id: string
          error_message: string
        }[]
      }
      check_subscription_status: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      check_trial_status: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      create_subscription: {
        Args: {
          p_user_id: string
          p_plan_id: string
          p_plan_type: string
          p_trial_end_date: string
          p_current_period_start: string
          p_current_period_end: string
        }
        Returns: undefined
      }
      create_user_subscription: {
        Args: {
          p_user_id: string
          p_plan_type: string
          p_is_redeem_code: boolean
        }
        Returns: string
      }
      delete_event_and_related_booking: {
        Args: { p_event_id: string; p_user_id: string }
        Returns: number
      }
      delete_recurring_series: {
        Args: {
          p_event_id: string
          p_user_id: string
          p_delete_choice?: string
        }
        Returns: number
      }
      generate_code_number: {
        Args: { n: number }
        Returns: string
      }
      generate_recurring_events: {
        Args: {
          p_parent_event_id: string
          p_start_date: string
          p_end_date: string
          p_repeat_pattern: string
          p_repeat_until: string
          p_user_id: string
        }
        Returns: number
      }
      get_all_related_files: {
        Args: {
          event_id_param?: string
          customer_id_param?: string
          entity_name_param?: string
        }
        Returns: {
          id: string
          filename: string
          file_path: string
          content_type: string
          size: number
          created_at: string
          user_id: string
          event_id: string
          customer_id: string
          source: string
        }[]
      }
      get_booking_request_files: {
        Args: { booking_id_param: string }
        Returns: {
          id: string
          filename: string
          file_path: string
          content_type: string
          size: number
          created_at: string
          user_id: string
          event_id: string
        }[]
      }
      get_business_owner_email: {
        Args: { business_id_param: string }
        Returns: {
          email: string
        }[]
      }
      get_public_events_by_user_id: {
        Args: { user_id_param: string }
        Returns: {
          booking_request_id: string | null
          content_type: string | null
          created_at: string | null
          deleted_at: string | null
          end_date: string
          event_name: string | null
          event_notes: string | null
          file_path: string | null
          file_size: number | null
          filename: string | null
          group_member_count: number | null
          group_name: string | null
          id: string
          is_group_event: boolean | null
          is_recurring: boolean | null
          language: string | null
          original_booking_id: string | null
          parent_event_id: string | null
          parent_group_id: string | null
          payment_amount: number | null
          payment_status: string | null
          recurrence_instance_date: string | null
          repeat_pattern: string | null
          repeat_until: string | null
          size: number | null
          social_network_link: string | null
          start_date: string
          title: string
          type: string | null
          user_id: string | null
          user_number: string | null
          user_surname: string | null
        }[]
      }
      get_task_stats: {
        Args: { user_id_param: string }
        Returns: {
          total: number
          completed: number
          in_progress: number
          todo: number
        }[]
      }
      save_event_with_persons: {
        Args: {
          p_event_data: Json
          p_additional_persons: Json
          p_user_id: string
          p_event_id?: string
        }
        Returns: string
      }
      validate_and_use_redeem_code: {
        Args: { p_code: string; p_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
