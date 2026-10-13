// Types for the DilapTrack database, in the shape produced by
// `supabase gen types typescript`. Regenerate after schema changes with:
//   npx supabase gen types typescript --project-id <ref> --schema public > src/lib/database.types.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type AppRole = "admin" | "project_manager" | "site_engineer" | "read_only";
type LotStatus = "not_started" | "in_progress" | "on_hold" | "closed";
type SurveyType = "pre_construction" | "post_construction";
type SurveyStatus = "not_started" | "scheduled" | "in_progress" | "complete";
type FileCategory = "pre_construction" | "post_construction" | "closeout" | "reports";
type LandholderRole = "road_authority" | "owner" | "adjacent_resident" | "occupier" | "other";

type LotRow = {
  id: string;
  lot_number: string;
  address: string | null;
  landholder_id: string | null;
  chainage: string | null;
  chainage_m: number | null;
  status: LotStatus;
  assigned_engineer: string | null;
  notes: string | null;
  landholder_signoff_date: string | null;
  landholder_signoff_name: string | null;
  landholder_signoff_notes: string | null;
  closed_at: string | null;
  closed_by: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          role: AppRole;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string;
          full_name?: string;
          role?: AppRole;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          role?: AppRole;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      lots: {
        Row: LotRow;
        Insert: {
          id?: string;
          lot_number: string;
          address?: string | null;
          chainage?: string | null;
          status?: LotStatus;
          assigned_engineer?: string | null;
          notes?: string | null;
          landholder_signoff_date?: string | null;
          landholder_signoff_name?: string | null;
          landholder_signoff_notes?: string | null;
        };
        Update: {
          lot_number?: string;
          address?: string | null;
          chainage?: string | null;
          status?: LotStatus;
          assigned_engineer?: string | null;
          notes?: string | null;
          landholder_signoff_date?: string | null;
          landholder_signoff_name?: string | null;
          landholder_signoff_notes?: string | null;
        };
        Relationships: [];
      };
      surveys: {
        Row: {
          id: string;
          lot_id: string;
          survey_type: SurveyType;
          status: SurveyStatus;
          survey_date: string | null;
          surveyor: string | null;
          notes: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          lot_id: string;
          survey_type: SurveyType;
          status?: SurveyStatus;
          survey_date?: string | null;
          surveyor?: string | null;
          notes?: string | null;
        };
        Update: {
          status?: SurveyStatus;
          survey_date?: string | null;
          surveyor?: string | null;
          notes?: string | null;
        };
        Relationships: [
          { foreignKeyName: "surveys_lot_id_fkey"; columns: ["lot_id"]; isOneToOne: false; referencedRelation: "lots"; referencedColumns: ["id"] },
        ];
      };
      landholders: {
        Row: {
          id: string;
          name: string;
          phone: string | null;
          email: string | null;
          postal_address: string | null;
          notes: string | null;
          created_at: string;
          created_by: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          phone?: string | null;
          email?: string | null;
          postal_address?: string | null;
          notes?: string | null;
        };
        Update: {
          name?: string;
          phone?: string | null;
          email?: string | null;
          postal_address?: string | null;
          notes?: string | null;
        };
        Relationships: [];
      };
      lot_landholders: {
        Row: {
          id: string;
          lot_id: string;
          landholder_id: string;
          role: LandholderRole;
          property: string | null;
          restoration_required: boolean;
          damage_notes: string | null;
          acceptance_date: string | null;
          acceptance_name: string | null;
          acceptance_notes: string | null;
          created_at: string;
          created_by: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          lot_id: string;
          landholder_id: string;
          role?: LandholderRole;
          property?: string | null;
          restoration_required?: boolean;
          damage_notes?: string | null;
          acceptance_date?: string | null;
          acceptance_name?: string | null;
          acceptance_notes?: string | null;
        };
        Update: {
          role?: LandholderRole;
          property?: string | null;
          restoration_required?: boolean;
          damage_notes?: string | null;
          acceptance_date?: string | null;
          acceptance_name?: string | null;
          acceptance_notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "lot_landholders_landholder_id_fkey";
            columns: ["landholder_id"];
            isOneToOne: false;
            referencedRelation: "landholders";
            referencedColumns: ["id"];
          },
          { foreignKeyName: "lot_landholders_lot_id_fkey"; columns: ["lot_id"]; isOneToOne: false; referencedRelation: "lots"; referencedColumns: ["id"] },
        ];
      };
      issued_reports: {
        Row: {
          id: string;
          lot_id: string;
          landholder_id: string | null;
          attachment_id: string;
          title: string;
          issued_to: string | null;
          notes: string | null;
          photo_count: number;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          lot_id: string;
          landholder_id?: string | null;
          attachment_id: string;
          title: string;
          issued_to?: string | null;
          notes?: string | null;
          photo_count?: number;
        };
        Update: never;
        Relationships: [];
      };
      attachments: {
        Row: {
          id: string;
          lot_id: string;
          category: FileCategory;
          survey_id: string | null;
          landholder_id: string | null;
          storage_path: string;
          preview_path: string | null;
          file_name: string;
          mime_type: string | null;
          size_bytes: number | null;
          kind: "photo" | "video" | "document";
          caption: string | null;
          uploaded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          lot_id: string;
          category: FileCategory;
          survey_id?: string | null;
          landholder_id?: string | null;
          storage_path: string;
          preview_path?: string | null;
          file_name: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          caption?: string | null;
          uploaded_by?: string | null;
        };
        Update: {
          caption?: string | null;
          landholder_id?: string | null;
        };
        Relationships: [
          { foreignKeyName: "attachments_lot_id_fkey"; columns: ["lot_id"]; isOneToOne: false; referencedRelation: "lots"; referencedColumns: ["id"] },
        ];
      };
      audit_log: {
        Row: {
          id: number;
          table_name: string;
          record_id: string | null;
          lot_id: string | null;
          action: "INSERT" | "UPDATE" | "DELETE";
          changed_fields: string[] | null;
          old_data: Json | null;
          new_data: Json | null;
          actor_id: string | null;
          actor_name: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: {
      lot_overview: {
        Row: LotRow & {
          landholder_name: string | null;
          landholder_phone: string | null;
          landholder_email: string | null;
          pre_survey_status: SurveyStatus;
          pre_survey_date: string | null;
          pre_surveyor: string | null;
          post_survey_status: SurveyStatus;
          post_survey_date: string | null;
          post_surveyor: string | null;
          file_count: number;
          ready_to_close: boolean;
          landholder_count: number;
          landholder_names: string | null;
          restorations: number;
          acceptances_outstanding: number;
          issued_report_count: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      import_lots: {
        Args: { p_rows: Json };
        Returns: Json;
      };
      lot_closeout_blockers: {
        Args: { p_lot_id: string };
        Returns: string[];
      };
    };
    Enums: {
      app_role: AppRole;
      lot_status: LotStatus;
      survey_type: SurveyType;
      survey_status: SurveyStatus;
      file_category: FileCategory;
      landholder_role: LandholderRole;
    };
    CompositeTypes: Record<string, never>;
  };
};

type PublicSchema = Database["public"];
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type Views<T extends keyof PublicSchema["Views"]> = PublicSchema["Views"][T]["Row"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];
