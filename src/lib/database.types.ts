// Types de la base, alignés sur supabase/schema.sql.
// Pour les régénérer automatiquement :
//   npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type MemberColor = 'blue' | 'orange';
export type MessageKind = 'text' | 'items_added' | 'event_added' | 'document_added' | 'document_expiring';
export type DocType = 'passeport' | 'identite' | 'permis' | 'vitale' | 'assurance' | 'carte_grise' | 'autre';

type HouseholdRow = {
  id: string;
  name: string;
  invite_code: string;
  chat_show_shopping: boolean;
  chat_show_events: boolean;
  chat_show_documents: boolean;
  created_by: string | null;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      households: {
        Row: HouseholdRow;
        Insert: never;
        Update: {
          name?: string;
          chat_show_shopping?: boolean;
          chat_show_events?: boolean;
          chat_show_documents?: boolean;
        };
        Relationships: [];
      };
      household_members: {
        Row: {
          user_id: string;
          household_id: string;
          display_name: string;
          color: MemberColor;
          expo_push_token: string | null;
          last_read_at: string;
          joined_at: string;
        };
        Insert: never;
        Update: {
          display_name?: string;
          expo_push_token?: string | null;
          last_read_at?: string;
        };
        Relationships: [];
      };
      shopping_items: {
        Row: {
          id: string;
          household_id: string;
          name: string;
          quantity: string | null;
          category: string;
          checked: boolean;
          added_by: string | null;
          checked_by: string | null;
          checked_at: string | null;
          archived_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          name: string;
          quantity?: string | null;
          category?: string;
          checked?: boolean;
        };
        Update: {
          name?: string;
          quantity?: string | null;
          category?: string;
          checked?: boolean;
          archived_at?: string | null;
        };
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          household_id: string;
          title: string;
          doc_type: DocType;
          owner_user: string | null;
          expires_at: string | null;
          remind_days: number[];
          agenda_event_id: string | null;
          notes: string | null;
          file_path: string | null;
          thumb_path: string | null;
          page_count: number | null;
          size_bytes: number | null;
          last_alert_days: number | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          title: string;
          doc_type?: DocType;
          owner_user?: string | null;
          expires_at?: string | null;
          remind_days?: number[];
          agenda_event_id?: string | null;
          notes?: string | null;
          file_path?: string | null;
          thumb_path?: string | null;
          page_count?: number | null;
          size_bytes?: number | null;
        };
        Update: {
          title?: string;
          doc_type?: DocType;
          owner_user?: string | null;
          expires_at?: string | null;
          remind_days?: number[];
          agenda_event_id?: string | null;
          notes?: string | null;
          file_path?: string | null;
          thumb_path?: string | null;
          page_count?: number | null;
          size_bytes?: number | null;
        };
        Relationships: [];
      };
      events: {
        Row: {
          id: string;
          household_id: string;
          title: string;
          starts_at: string;
          ends_at: string | null;
          all_day: boolean;
          for_user: string | null;
          location: string | null;
          reminder_minutes: number | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          title: string;
          starts_at: string;
          ends_at?: string | null;
          all_day?: boolean;
          for_user?: string | null;
          location?: string | null;
          reminder_minutes?: number | null;
        };
        Update: {
          title?: string;
          starts_at?: string;
          ends_at?: string | null;
          all_day?: boolean;
          for_user?: string | null;
          location?: string | null;
          reminder_minutes?: number | null;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          household_id: string;
          sender_id: string | null;
          kind: MessageKind;
          body: string;
          meta: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          sender_id: string;
          kind?: 'text';
          body: string;
        };
        Update: never;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      create_household: {
        Args: { p_display_name: string; p_name?: string };
        Returns: HouseholdRow;
      };
      join_household: {
        Args: { p_code: string; p_display_name: string };
        Returns: HouseholdRow;
      };
      check_document_alerts: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      my_household_id: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicTables = Database['public']['Tables'];
export type Household = PublicTables['households']['Row'];
export type HouseholdUpdate = PublicTables['households']['Update'];
export type Member = PublicTables['household_members']['Row'];
export type ShoppingItem = PublicTables['shopping_items']['Row'];
export type Message = PublicTables['messages']['Row'];
export type CalendarEvent = PublicTables['events']['Row'];
export type HouseDocument = PublicTables['documents']['Row'];
export type HouseDocumentUpdate = PublicTables['documents']['Update'];
export type CalendarEventInput = Omit<PublicTables['events']['Insert'], 'household_id' | 'id'>;
