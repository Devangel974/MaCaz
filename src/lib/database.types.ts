// Types de la base, alignés sur supabase/schema.sql.
// Pour les régénérer automatiquement :
//   npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type MemberColor = 'blue' | 'orange';
export type MessageKind = 'text' | 'items_added' | 'event_added';

type HouseholdRow = {
  id: string;
  name: string;
  invite_code: string;
  created_by: string | null;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      households: {
        Row: HouseholdRow;
        Insert: never;
        Update: { name?: string };
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
export type Member = PublicTables['household_members']['Row'];
export type ShoppingItem = PublicTables['shopping_items']['Row'];
export type Message = PublicTables['messages']['Row'];
export type CalendarEvent = PublicTables['events']['Row'];
export type CalendarEventInput = Omit<PublicTables['events']['Insert'], 'household_id' | 'id'>;
