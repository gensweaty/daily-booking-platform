export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
          event_notes: string | null
          id: string
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
          event_notes?: string | null
          id?: string
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
          event_notes?: string | null
          id?: string
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
        Relationships: []
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
          event_notes: string | null
          file_path: string | null
          file_size: number | null
          filename: string | null
          id: string
          original_booking_id: string | null
          payment_amount: number | null
          payment_status: string | null
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
          event_notes?: string | null
          file_path?: string | null
          file_size?: number | null
          filename?: string | null
          id?: string
          original_booking_id?: string | null
          payment_amount?: number | null
          payment_status?: string | null
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
          event_notes?: string | null
          file_path?: string | null
          file_size?: number | null
          filename?: string | null
          id?: string
          original_booking_id?: string | null
          payment_amount?: number | null
          payment_status?: string | null
          size?: number | null
          social_network_link?: string | null
          start_date?: string
          title?: string
          type?: string | null
          user_id?: string | null
          user_number?: string | null
          user_surname?: string | null
        }
        Relationships: []
      }
      files: {
        Row: {
          content_type: string | null
          created_at: string | null
          file_path: string
          filename: string
          id: string
          size: number | null
          task_id: string | null
          user_id: string | null
        }
        Insert: {
          content_type?: string | null
          created_at?: string | null
          file_path: string
          filename: string
          id?: string
          size?: number | null
          task_id?: string | null
          user_id?: string | null
        }
        Update: {
          content_type?: string | null
          created_at?: string | null
          file_path?: string
          filename?: string
          id?: string
          size?: number | null
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
          created_at: string | null
          id: string
          username: string
        }
        Insert: {
          created_at?: string | null
          id: string
          username: string
        }
        Update: {
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
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          last_payment_id: string | null
          plan_id: string
          plan_type: string
          status: string
          trial_end_date: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          last_payment_id?: string | null
          plan_id: string
          plan_type: string
          status: string
          trial_end_date?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          last_payment_id?: string | null
          plan_id?: string
          plan_type?: string
          status?: string
          trial_end_date?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          position: number | null
          status: string
          title: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          position?: number | null
          status?: string
          title: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          position?: number | null
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
      generate_code_number: {
        Args: { n: number }
        Returns: string
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
      get_public_events_by_user_id: {
        Args: { user_id_param: string }
        Returns: {
          booking_request_id: string | null
          content_type: string | null
          created_at: string | null
          deleted_at: string | null
          end_date: string
          event_notes: string | null
          file_path: string | null
          file_size: number | null
          filename: string | null
          id: string
          original_booking_id: string | null
          payment_amount: number | null
          payment_status: string | null
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

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
