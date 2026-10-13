// Types for the DilapTrack database, in the shape produced by
// `supabase gen types typescript`. Regenerate after schema changes with:
//   npx supabase gen types typescript --project-id <ref> --schema public > src/lib/database.types.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type AppRole = "admin" | "project_manager" | "site_engineer" | "read_only";
type LotStatus = "not_started" | "in_progress" | "on_hold" | "closed";
type SurveyType = "pre_construction" | "post_construction";
type SurveyStatus = "not_started" | "scheduled" | "in_progress" | "complete";
type DefectPriority = "low" | "medium" | "high" | "critical";
type DefectStatus = "open" | "in_progress" | "closed";
type ReinstatementStatus = "not_started" | "in_progress" | "complete";
type FileCategory = "pre_construction" | "post_construction" | "defects" | "reinstatement" | "closeout";

type LotRow = {
  id: string;
  lot_number: string;
  address: string | null;
  landholder: string | null;
  landholder_contact: string | null;
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
          landholder?: string | null;
          landholder_contact?: string | null;
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
          landholder?: string | null;
          landholder_contact?: string | null;
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
      defects: {
        Row: {
          id: string;
          ref: number;
          lot_id: string;
          description: string;
          priority: DefectPriority;
          status: DefectStatus;
          assigned_to: string | null;
          due_date: string | null;
          notes: string | null;
          closed_at: string | null;
          created_at: string;
          created_by: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          lot_id: string;
          description: string;
          priority?: DefectPriority;
          status?: DefectStatus;
          assigned_to?: string | null;
          due_date?: string | null;
          notes?: string | null;
        };
        Update: {
          description?: string;
          priority?: DefectPriority;
          status?: DefectStatus;
          assigned_to?: string | null;
          due_date?: string | null;
          notes?: string | null;
        };
        Relationships: [
          { foreignKeyName: "defects_lot_id_fkey"; columns: ["lot_id"]; isOneToOne: false; referencedRelation: "lots"; referencedColumns: ["id"] },
        ];
      };
      reinstatement_items: {
        Row: {
          id: string;
          ref: number;
          lot_id: string;
          required_works: string;
          status: ReinstatementStatus;
          completion_date: string | null;
          landholder_accepted: boolean;
          landholder_accepted_date: string | null;
          notes: string | null;
          created_at: string;
          created_by: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          lot_id: string;
          required_works: string;
          status?: ReinstatementStatus;
          completion_date?: string | null;
          landholder_accepted?: boolean;
          landholder_accepted_date?: string | null;
          notes?: string | null;
        };
        Update: {
          required_works?: string;
          status?: ReinstatementStatus;
          completion_date?: string | null;
          landholder_accepted?: boolean;
          landholder_accepted_date?: string | null;
          notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "reinstatement_items_lot_id_fkey";
            columns: ["lot_id"];
            isOneToOne: false;
            referencedRelation: "lots";
            referencedColumns: ["id"];
          },
        ];
      };
      attachments: {
        Row: {
          id: string;
          lot_id: string;
          category: FileCategory;
          survey_id: string | null;
          defect_id: string | null;
          reinstatement_id: string | null;
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
          defect_id?: string | null;
          reinstatement_id?: string | null;
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
          pre_survey_status: SurveyStatus;
          pre_survey_date: string | null;
          post_survey_status: SurveyStatus;
          post_survey_date: string | null;
          open_defects: number;
          total_defects: number;
          open_reinstatement: number;
          total_reinstatement: number;
          ready_to_close: boolean;
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
      defect_priority: DefectPriority;
      defect_status: DefectStatus;
      reinstatement_status: ReinstatementStatus;
      file_category: FileCategory;
    };
    CompositeTypes: Record<string, never>;
  };
};

type PublicSchema = Database["public"];
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type Views<T extends keyof PublicSchema["Views"]> = PublicSchema["Views"][T]["Row"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];
