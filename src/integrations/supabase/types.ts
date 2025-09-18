export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
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
      chat_channels: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          created_by_id: string | null
          created_by_type: string | null
          custom_sig: string | null
          dm_pair_key: string | null
          emoji: string | null
          id: string
          is_custom: boolean
          is_default: boolean | null
          is_deleted: boolean
          is_dm: boolean | null
          is_private: boolean | null
          name: string
          owner_id: string
          participants: Json | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          created_by_id?: string | null
          created_by_type?: string | null
          custom_sig?: string | null
          dm_pair_key?: string | null
          emoji?: string | null
          id?: string
          is_custom?: boolean
          is_default?: boolean | null
          is_deleted?: boolean
          is_dm?: boolean | null
          is_private?: boolean | null
          name: string
          owner_id: string
          participants?: Json | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          created_by_id?: string | null
          created_by_type?: string | null
          custom_sig?: string | null
          dm_pair_key?: string | null
          emoji?: string | null
          id?: string
          is_custom?: boolean
          is_default?: boolean | null
          is_deleted?: boolean
          is_dm?: boolean | null
          is_private?: boolean | null
          name?: string
          owner_id?: string
          participants?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      chat_message_files: {
        Row: {
          content_type: string | null
          created_at: string | null
          file_path: string
          filename: string
          id: string
          message_id: string
          size: number | null
        }
        Insert: {
          content_type?: string | null
          created_at?: string | null
          file_path: string
          filename: string
          id?: string
          message_id: string
          size?: number | null
        }
        Update: {
          content_type?: string | null
          created_at?: string | null
          file_path?: string
          filename?: string
          id?: string
          message_id?: string
          size?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_message_files_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_message_reactions: {
        Row: {
          created_at: string | null
          emoji: string
          id: string
          message_id: string
          sub_user_id: string | null
          user_id: string | null
          user_type: string
        }
        Insert: {
          created_at?: string | null
          emoji: string
          id?: string
          message_id: string
          sub_user_id?: string | null
          user_id?: string | null
          user_type: string
        }
        Update: {
          created_at?: string | null
          emoji?: string
          id?: string
          message_id?: string
          sub_user_id?: string | null
          user_id?: string | null
          user_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_message_reactions_sub_user_id_fkey"
            columns: ["sub_user_id"]
            isOneToOne: false
            referencedRelation: "sub_users"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          channel_id: string
          content: string
          created_at: string | null
          edited_at: string | null
          has_attachments: boolean | null
          id: string
          is_deleted: boolean | null
          message_type: string | null
          original_content: string | null
          owner_id: string | null
          reply_to_id: string | null
          sender_avatar_url: string | null
          sender_name: string | null
          sender_sub_user_id: string | null
          sender_type: string
          sender_user_id: string | null
          updated_at: string | null
        }
        Insert: {
          channel_id: string
          content: string
          created_at?: string | null
          edited_at?: string | null
          has_attachments?: boolean | null
          id?: string
          is_deleted?: boolean | null
          message_type?: string | null
          original_content?: string | null
          owner_id?: string | null
          reply_to_id?: string | null
          sender_avatar_url?: string | null
          sender_name?: string | null
          sender_sub_user_id?: string | null
          sender_type: string
          sender_user_id?: string | null
          updated_at?: string | null
        }
        Update: {
          channel_id?: string
          content?: string
          created_at?: string | null
          edited_at?: string | null
          has_attachments?: boolean | null
          id?: string
          is_deleted?: boolean | null
          message_type?: string | null
          original_content?: string | null
          owner_id?: string | null
          reply_to_id?: string | null
          sender_avatar_url?: string | null
          sender_name?: string | null
          sender_sub_user_id?: string | null
          sender_type?: string
          sender_user_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "chat_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_sender_sub_user_id_fkey"
            columns: ["sender_sub_user_id"]
            isOneToOne: false
            referencedRelation: "sub_users"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_participants: {
        Row: {
          channel_id: string
          id: string
          joined_at: string | null
          last_read_at: string
          sub_user_id: string | null
          user_id: string | null
          user_type: string
        }
        Insert: {
          channel_id: string
          id?: string
          joined_at?: string | null
          last_read_at?: string
          sub_user_id?: string | null
          user_id?: string | null
          user_type: string
        }
        Update: {
          channel_id?: string
          id?: string
          joined_at?: string | null
          last_read_at?: string
          sub_user_id?: string | null
          user_id?: string | null
          user_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_participants_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "chat_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_participants_sub_user_id_fkey"
            columns: ["sub_user_id"]
            isOneToOne: false
            referencedRelation: "sub_users"
            referencedColumns: ["id"]
          },
        ]
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
      comment_files: {
        Row: {
          comment_id: string
          content_type: string | null
          created_at: string | null
          file_path: string
          filename: string
          id: string
          size: number | null
          user_id: string | null
        }
        Insert: {
          comment_id: string
          content_type?: string | null
          created_at?: string | null
          file_path: string
          filename: string
          id?: string
          size?: number | null
          user_id?: string | null
        }
        Update: {
          comment_id?: string
          content_type?: string | null
          created_at?: string | null
          file_path?: string
          filename?: string
          id?: string
          size?: number | null
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
          created_by_name: string | null
          created_by_type: string | null
          deleted_at: string | null
          end_date: string | null
          event_id: string | null
          event_notes: string | null
          id: string
          is_group_member: boolean | null
          last_edited_at: string | null
          last_edited_by_name: string | null
          last_edited_by_type: string | null
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
          created_by_name?: string | null
          created_by_type?: string | null
          deleted_at?: string | null
          end_date?: string | null
          event_id?: string | null
          event_notes?: string | null
          id?: string
          is_group_member?: boolean | null
          last_edited_at?: string | null
          last_edited_by_name?: string | null
          last_edited_by_type?: string | null
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
          created_by_name?: string | null
          created_by_type?: string | null
          deleted_at?: string | null
          end_date?: string | null
          event_id?: string | null
          event_notes?: string | null
          id?: string
          is_group_member?: boolean | null
          last_edited_at?: string | null
          last_edited_by_name?: string | null
          last_edited_by_type?: string | null
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
          created_by_name: string | null
          created_by_type: string | null
          deleted_at: string | null
          email_reminder_enabled: boolean | null
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
          last_edited_at: string | null
          last_edited_by_name: string | null
          last_edited_by_type: string | null
          original_booking_id: string | null
          parent_event_id: string | null
          parent_group_id: string | null
          payment_amount: number | null
          payment_status: string | null
          recurrence_instance_date: string | null
          reminder_at: string | null
          reminder_sent_at: string | null
          reminder_time: string | null
          repeat_pattern: string | null
          repeat_until: string | null
          size: number | null
          social_network_link: string | null
          start_date: string
          title: string
          type: string | null
          updated_at: string | null
          user_id: string | null
          user_number: string | null
          user_surname: string | null
        }
        Insert: {
          booking_request_id?: string | null
          content_type?: string | null
          created_at?: string | null
          created_by_name?: string | null
          created_by_type?: string | null
          deleted_at?: string | null
          email_reminder_enabled?: boolean | null
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
          last_edited_at?: string | null
          last_edited_by_name?: string | null
          last_edited_by_type?: string | null
          original_booking_id?: string | null
          parent_event_id?: string | null
          parent_group_id?: string | null
          payment_amount?: number | null
          payment_status?: string | null
          recurrence_instance_date?: string | null
          reminder_at?: string | null
          reminder_sent_at?: string | null
          reminder_time?: string | null
          repeat_pattern?: string | null
          repeat_until?: string | null
          size?: number | null
          social_network_link?: string | null
          start_date: string
          title: string
          type?: string | null
          updated_at?: string | null
          user_id?: string | null
          user_number?: string | null
          user_surname?: string | null
        }
        Update: {
          booking_request_id?: string | null
          content_type?: string | null
          created_at?: string | null
          created_by_name?: string | null
          created_by_type?: string | null
          deleted_at?: string | null
          email_reminder_enabled?: boolean | null
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
          last_edited_at?: string | null
          last_edited_by_name?: string | null
          last_edited_by_type?: string | null
          original_booking_id?: string | null
          parent_event_id?: string | null
          parent_group_id?: string | null
          payment_amount?: number | null
          payment_status?: string | null
          recurrence_instance_date?: string | null
          reminder_at?: string | null
          reminder_sent_at?: string | null
          reminder_time?: string | null
          repeat_pattern?: string | null
          repeat_until?: string | null
          size?: number | null
          social_network_link?: string | null
          start_date?: string
          title?: string
          type?: string | null
          updated_at?: string | null
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
          language: string | null
          timezone: string | null
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          id: string
          language?: string | null
          timezone?: string | null
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          id?: string
          language?: string | null
          timezone?: string | null
          username?: string
        }
        Relationships: []
      }
      public_board_access: {
        Row: {
          access_token: string
          board_id: string
          created_at: string
          external_user_email: string | null
          external_user_name: string
          id: string
          last_accessed_at: string
        }
        Insert: {
          access_token: string
          board_id: string
          created_at?: string
          external_user_email?: string | null
          external_user_name: string
          id?: string
          last_accessed_at?: string
        }
        Update: {
          access_token?: string
          board_id?: string
          created_at?: string
          external_user_email?: string | null
          external_user_name?: string
          id?: string
          last_accessed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_board_access_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "public_boards"
            referencedColumns: ["id"]
          },
        ]
      }
      public_boards: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          magic_word: string
          slug: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          magic_word: string
          slug?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          magic_word?: string
          slug?: string | null
          updated_at?: string
          user_id?: string
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
      reminder_entries: {
        Row: {
          created_at: string
          delivered: boolean
          delivered_at: string | null
          event_id: string | null
          id: string
          remind_at: string
          task_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delivered?: boolean
          delivered_at?: string | null
          event_id?: string | null
          id?: string
          remind_at: string
          task_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          delivered?: boolean
          delivered_at?: string | null
          event_id?: string | null
          id?: string
          remind_at?: string
          task_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminder_entries_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_entries_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
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
      sub_users: {
        Row: {
          avatar_url: string | null
          board_owner_id: string
          calendar_permission: boolean | null
          created_at: string
          crm_permission: boolean | null
          email: string
          fullname: string
          id: string
          last_login_at: string
          password_hash: string | null
          password_salt: string | null
          statistics_permission: boolean | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          board_owner_id: string
          calendar_permission?: boolean | null
          created_at?: string
          crm_permission?: boolean | null
          email: string
          fullname: string
          id?: string
          last_login_at?: string
          password_hash?: string | null
          password_salt?: string | null
          statistics_permission?: boolean | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          board_owner_id?: string
          calendar_permission?: boolean | null
          created_at?: string
          crm_permission?: boolean | null
          email?: string
          fullname?: string
          id?: string
          last_login_at?: string
          password_hash?: string | null
          password_salt?: string | null
          statistics_permission?: boolean | null
          updated_at?: string
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
      task_comments: {
        Row: {
          content: string
          created_at: string
          created_by_name: string | null
          created_by_type: string | null
          deleted_at: string | null
          id: string
          last_edited_at: string | null
          last_edited_by_name: string | null
          last_edited_by_type: string | null
          task_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          created_by_name?: string | null
          created_by_type?: string | null
          deleted_at?: string | null
          id?: string
          last_edited_at?: string | null
          last_edited_by_name?: string | null
          last_edited_by_type?: string | null
          task_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          created_by_name?: string | null
          created_by_type?: string | null
          deleted_at?: string | null
          id?: string
          last_edited_at?: string | null
          last_edited_by_name?: string | null
          last_edited_by_type?: string | null
          task_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          archived: boolean | null
          archived_at: string | null
          created_at: string | null
          created_by_name: string | null
          created_by_type: string | null
          deadline_at: string | null
          description: string | null
          email_reminder: boolean | null
          email_reminder_enabled: boolean | null
          external_user_email: string | null
          id: string
          last_edited_at: string | null
          last_edited_by_name: string | null
          last_edited_by_type: string | null
          position: number | null
          reminder_at: string | null
          reminder_sent: boolean | null
          reminder_sent_at: string | null
          status: string
          timezone: string | null
          title: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          archived?: boolean | null
          archived_at?: string | null
          created_at?: string | null
          created_by_name?: string | null
          created_by_type?: string | null
          deadline_at?: string | null
          description?: string | null
          email_reminder?: boolean | null
          email_reminder_enabled?: boolean | null
          external_user_email?: string | null
          id?: string
          last_edited_at?: string | null
          last_edited_by_name?: string | null
          last_edited_by_type?: string | null
          position?: number | null
          reminder_at?: string | null
          reminder_sent?: boolean | null
          reminder_sent_at?: string | null
          status?: string
          timezone?: string | null
          title: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          archived?: boolean | null
          archived_at?: string | null
          created_at?: string | null
          created_by_name?: string | null
          created_by_type?: string | null
          deadline_at?: string | null
          description?: string | null
          email_reminder?: boolean | null
          email_reminder_enabled?: boolean | null
          external_user_email?: string | null
          id?: string
          last_edited_at?: string | null
          last_edited_by_name?: string | null
          last_edited_by_type?: string | null
          position?: number | null
          reminder_at?: string | null
          reminder_sent?: boolean | null
          reminder_sent_at?: string | null
          status?: string
          timezone?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _as_service_role: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      activate_subscription: {
        Args: { p_subscription_type: string; p_user_id: string }
        Returns: Json
      }
      attach_files_to_message_public: {
        Args: {
          p_channel_id: string
          p_files: Json
          p_owner_id: string
          p_sender_email: string
        }
        Returns: undefined
      }
      attach_files_to_message_public_by_id: {
        Args: { p_files: Json; p_message_id: string; p_owner_id: string }
        Returns: undefined
      }
      canonical_participant_key: {
        Args: { p_id: string; p_type: string }
        Returns: string
      }
      check_and_lock_redeem_code: {
        Args: { p_code: string }
        Returns: {
          code_id: string
          error_message: string
          is_valid: boolean
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
      consolidate_duplicate_dm_channels: {
        Args: Record<PropertyKey, never>
        Returns: {
          consolidated_channels_count: number
          migrated_messages_count: number
        }[]
      }
      create_custom_chat: {
        Args:
          | {
              p_avatar_url?: string
              p_creator_id: string
              p_creator_type: string
              p_name: string
              p_owner_id: string
              p_participants: Json
            }
          | {
              p_creator_id: string
              p_creator_type: string
              p_name: string
              p_owner_id: string
              p_participants: Json
            }
        Returns: string
      }
      create_subscription: {
        Args: {
          p_current_period_end: string
          p_current_period_start: string
          p_plan_id: string
          p_plan_type: string
          p_trial_end_date: string
          p_user_id: string
        }
        Returns: undefined
      }
      create_user_subscription: {
        Args: {
          p_is_redeem_code: boolean
          p_plan_type: string
          p_user_id: string
        }
        Returns: string
      }
      delete_custom_chat: {
        Args: {
          p_channel_id: string
          p_owner_id: string
          p_requester_id: string
          p_requester_type: string
        }
        Returns: undefined
      }
      delete_event_and_related_booking: {
        Args: { p_event_id: string; p_user_id: string }
        Returns: number
      }
      delete_public_board_message: {
        Args: {
          p_message_id: string
          p_owner_id: string
          p_sender_email: string
        }
        Returns: undefined
      }
      delete_recurring_series: {
        Args: {
          p_delete_choice?: string
          p_event_id: string
          p_user_id: string
        }
        Returns: number
      }
      dm_order_pair: {
        Args: { a_id: string; a_type: string; b_id: string; b_type: string }
        Returns: {
          left_id: string
          left_type: string
          right_id: string
          right_type: string
        }[]
      }
      dm_sort_key: {
        Args: { p_id: string; p_type: string }
        Returns: string
      }
      edit_public_board_message: {
        Args: {
          p_content: string
          p_message_id: string
          p_owner_id: string
          p_sender_email: string
        }
        Returns: undefined
      }
      ensure_dm_channel: {
        Args: {
          p_a_id: string
          p_a_type: string
          p_b_id: string
          p_b_type: string
          p_board_owner_id: string
        }
        Returns: string
      }
      find_or_create_dm: {
        Args: {
          p_a_id: string
          p_a_type: string
          p_b_id: string
          p_b_type: string
          p_owner_id: string
        }
        Returns: string
      }
      generate_code_number: {
        Args: { n: number }
        Returns: string
      }
      generate_recurring_events: {
        Args: {
          p_end_date: string
          p_parent_event_id: string
          p_repeat_pattern: string
          p_repeat_until: string
          p_start_date: string
          p_user_id: string
        }
        Returns: number
      }
      get_admin_display_name: {
        Args: { p_user_id: string }
        Returns: string
      }
      get_all_related_files: {
        Args: {
          customer_id_param?: string
          entity_name_param?: string
          event_id_param?: string
        }
        Returns: {
          content_type: string
          created_at: string
          customer_id: string
          event_id: string
          file_path: string
          filename: string
          id: string
          size: number
          source: string
          user_id: string
        }[]
      }
      get_booking_request_files: {
        Args: { booking_id_param: string }
        Returns: {
          content_type: string
          created_at: string
          event_id: string
          file_path: string
          filename: string
          id: string
          size: number
          user_id: string
        }[]
      }
      get_business_owner_email: {
        Args: { business_id_param: string }
        Returns: {
          email: string
        }[]
      }
      get_channel_header_internal: {
        Args: {
          p_channel_id: string
          p_owner_id: string
          p_viewer_id: string
          p_viewer_type: string
        }
        Returns: {
          is_dm: boolean
          name: string
          partner_avatar_url: string
          partner_name: string
        }[]
      }
      get_channel_header_public: {
        Args: {
          p_channel_id: string
          p_owner_id: string
          p_requester_email: string
        }
        Returns: {
          is_dm: boolean
          name: string
          partner_avatar_url: string
          partner_name: string
        }[]
      }
      get_chat_messages_for_channel: {
        Args: { p_board_owner_id: string; p_channel_id: string }
        Returns: {
          channel_id: string
          content: string
          created_at: string
          edited_at: string
          has_attachments: boolean
          id: string
          is_deleted: boolean
          message_type: string
          original_content: string
          sender_avatar_url: string
          sender_name: string
          sender_sub_user_id: string
          sender_type: string
          sender_user_id: string
          updated_at: string
        }[]
      }
      get_chat_messages_for_channel_paged: {
        Args: {
          p_before?: string
          p_board_owner_id: string
          p_channel_id: string
          p_limit?: number
        }
        Returns: {
          channel_id: string
          content: string
          created_at: string
          edited_at: string
          has_attachments: boolean
          id: string
          is_deleted: boolean
          message_type: string
          original_content: string
          sender_avatar_url: string
          sender_name: string
          sender_sub_user_id: string
          sender_type: string
          sender_user_id: string
          updated_at: string
        }[]
      }
      get_default_channel_for_board: {
        Args: { p_board_owner_id: string }
        Returns: {
          id: string
          name: string
          participant_count: number
        }[]
      }
      get_dm_channels_for_sub_user: {
        Args: { p_email: string; p_owner_id: string }
        Returns: {
          channel_id: string
          other_sub_user_id: string
          other_type: string
          other_user_id: string
        }[]
      }
      get_new_messages_multi_channel: {
        Args: {
          p_owner_id: string
          p_since_timestamp?: string
          p_user_email: string
        }
        Returns: {
          channel_id: string
          content: string
          created_at: string
          message_id: string
          sender_avatar_url: string
          sender_name: string
          sender_type: string
        }[]
      }
      get_or_create_canonical_dm: {
        Args: {
          p_a_id: string
          p_a_type: string
          p_b_id: string
          p_b_type: string
          p_board_owner_id: string
        }
        Returns: string
      }
      get_public_board_by_token: {
        Args: { access_token_param: string }
        Returns: {
          board_id: string
          external_user_name: string
          is_active: boolean
          magic_word: string
          user_id: string
        }[]
      }
      get_public_board_tasks: {
        Args: { board_user_id: string }
        Returns: {
          archived: boolean | null
          archived_at: string | null
          created_at: string | null
          created_by_name: string | null
          created_by_type: string | null
          deadline_at: string | null
          description: string | null
          email_reminder: boolean | null
          email_reminder_enabled: boolean | null
          external_user_email: string | null
          id: string
          last_edited_at: string | null
          last_edited_by_name: string | null
          last_edited_by_type: string | null
          position: number | null
          reminder_at: string | null
          reminder_sent: boolean | null
          reminder_sent_at: string | null
          status: string
          timezone: string | null
          title: string
          updated_at: string | null
          user_id: string | null
        }[]
      }
      get_public_events_by_user_id: {
        Args: { user_id_param: string }
        Returns: {
          booking_request_id: string | null
          content_type: string | null
          created_at: string | null
          created_by_name: string | null
          created_by_type: string | null
          deleted_at: string | null
          email_reminder_enabled: boolean | null
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
          last_edited_at: string | null
          last_edited_by_name: string | null
          last_edited_by_type: string | null
          original_booking_id: string | null
          parent_event_id: string | null
          parent_group_id: string | null
          payment_amount: number | null
          payment_status: string | null
          recurrence_instance_date: string | null
          reminder_at: string | null
          reminder_sent_at: string | null
          reminder_time: string | null
          repeat_pattern: string | null
          repeat_until: string | null
          size: number | null
          social_network_link: string | null
          start_date: string
          title: string
          type: string | null
          updated_at: string | null
          user_id: string | null
          user_number: string | null
          user_surname: string | null
        }[]
      }
      get_sub_user_auth: {
        Args: { p_email: string; p_owner_id: string }
        Returns: {
          email: string
          fullname: string
          id: string
          password_hash: string
          password_salt: string
        }[]
      }
      get_task_stats: {
        Args: { user_id_param: string }
        Returns: {
          completed: number
          in_progress: number
          todo: number
          total: number
        }[]
      }
      get_team_members_for_board: {
        Args: { p_board_owner_id: string }
        Returns: {
          avatar_url: string
          id: string
          name: string
          type: string
        }[]
      }
      get_user_participating_channels: {
        Args: { p_owner_id: string; p_user_email: string; p_user_type: string }
        Returns: {
          channel_id: string
          channel_name: string
          is_dm: boolean
        }[]
      }
      list_channel_messages_public: {
        Args: {
          p_channel_id: string
          p_owner_id: string
          p_requester_email: string
          p_requester_type: string
        }
        Returns: {
          channel_id: string
          content: string
          created_at: string
          edited_at: string
          has_attachments: boolean
          id: string
          is_deleted: boolean
          message_type: string
          original_content: string
          sender_avatar_url: string
          sender_name: string
          sender_sub_user_id: string
          sender_type: string
          sender_user_id: string
          updated_at: string
        }[]
      }
      list_channel_messages_public_paged: {
        Args: {
          p_before?: string
          p_channel_id: string
          p_limit?: number
          p_owner_id: string
          p_requester_email: string
          p_requester_type: string
        }
        Returns: {
          channel_id: string
          content: string
          created_at: string | null
          edited_at: string | null
          has_attachments: boolean | null
          id: string
          is_deleted: boolean | null
          message_type: string | null
          original_content: string | null
          owner_id: string | null
          reply_to_id: string | null
          sender_avatar_url: string | null
          sender_name: string | null
          sender_sub_user_id: string | null
          sender_type: string
          sender_user_id: string | null
          updated_at: string | null
        }[]
      }
      list_channels_for_sub_user_public: {
        Args: { p_email: string; p_owner_id: string }
        Returns: {
          channel_id: string
        }[]
      }
      list_files_for_messages_public: {
        Args: { p_message_ids: string[] }
        Returns: {
          content_type: string
          file_path: string
          filename: string
          id: string
          message_id: string
          size: number
        }[]
      }
      make_dm_pair_key: {
        Args: {
          p_a_id: string
          p_a_type: string
          p_b_id: string
          p_b_type: string
        }
        Returns: string
      }
      mark_channel_read: {
        Args: {
          p_channel_id: string
          p_owner_id: string
          p_viewer_id: string
          p_viewer_type: string
        }
        Returns: undefined
      }
      save_event_with_persons: {
        Args:
          | {
              p_additional_persons: Json
              p_created_by_name?: string
              p_created_by_type?: string
              p_event_data: Json
              p_event_id?: string
              p_last_edited_by_name?: string
              p_last_edited_by_type?: string
              p_user_id: string
            }
          | {
              p_additional_persons: Json
              p_event_data: Json
              p_event_id?: string
              p_user_id: string
            }
        Returns: string
      }
      send_authenticated_message: {
        Args: { p_channel_id: string; p_content: string; p_owner_id: string }
        Returns: undefined
      }
      send_chat_message: {
        Args: {
          p_channel_id: string
          p_content: string
          p_owner_id: string
          p_sender_id: string
          p_sender_type: string
        }
        Returns: {
          channel_id: string
          content: string
          created_at: string | null
          edited_at: string | null
          has_attachments: boolean | null
          id: string
          is_deleted: boolean | null
          message_type: string | null
          original_content: string | null
          owner_id: string | null
          reply_to_id: string | null
          sender_avatar_url: string | null
          sender_name: string | null
          sender_sub_user_id: string | null
          sender_type: string
          sender_user_id: string | null
          updated_at: string | null
        }
      }
      send_public_board_message: {
        Args: {
          p_board_owner_id: string
          p_channel_id: string
          p_content: string
          p_sender_email: string
        }
        Returns: {
          created_at: string
          id: string
          sender_avatar_url: string
          sender_name: string
        }[]
      }
      start_public_board_dm: {
        Args:
          | {
              p_board_owner_id: string
              p_other_id: string
              p_other_type: string
              p_sender_email: string
            }
          | {
              p_board_owner_id: string
              p_sender_email: string
              p_target_id: string
              p_target_type: string
            }
        Returns: string
      }
      unread_counters: {
        Args: { p_owner_id: string; p_viewer_id: string; p_viewer_type: string }
        Returns: {
          channel_id: string
          channel_unread: number
          peer_id: string
          peer_type: string
          peer_unread: number
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
