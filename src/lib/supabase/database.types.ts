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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          created_at: string
          deactivated_at: string | null
          deactivated_by: string | null
          id: string
          role: Database["public"]["Enums"]["account_role"]
          status: Database["public"]["Enums"]["account_status"]
        }
        Insert: {
          created_at?: string
          deactivated_at?: string | null
          deactivated_by?: string | null
          id: string
          role?: Database["public"]["Enums"]["account_role"]
          status?: Database["public"]["Enums"]["account_status"]
        }
        Update: {
          created_at?: string
          deactivated_at?: string | null
          deactivated_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["account_role"]
          status?: Database["public"]["Enums"]["account_status"]
        }
        Relationships: [
          {
            foreignKeyName: "accounts_deactivated_by_fkey"
            columns: ["deactivated_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          id: boolean
          invitation_days: number
          max_guardians: number
          members_can_invite: boolean
        }
        Insert: {
          id?: boolean
          invitation_days?: number
          max_guardians?: number
          members_can_invite?: boolean
        }
        Update: {
          id?: boolean
          invitation_days?: number
          max_guardians?: number
          members_can_invite?: boolean
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          account_id: string | null
          action: string
          actor_id: string | null
          at: string
          details: Json
          id: number
          profile_id: string | null
        }
        Insert: {
          account_id?: string | null
          action: string
          actor_id?: string | null
          at?: string
          details?: Json
          id?: never
          profile_id?: string | null
        }
        Update: {
          account_id?: string | null
          action?: string
          actor_id?: string | null
          at?: string
          details?: Json
          id?: never
          profile_id?: string | null
        }
        Relationships: []
      }
      family_branches: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      family_relationships: {
        Row: {
          created_at: string
          created_by: string | null
          detail: string
          end_year: number | null
          id: string
          person_a: string
          person_b: string
          relationship: Database["public"]["Enums"]["relationship_type"]
          start_year: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          detail?: string
          end_year?: number | null
          id?: string
          person_a: string
          person_b: string
          relationship: Database["public"]["Enums"]["relationship_type"]
          start_year?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          detail?: string
          end_year?: number | null
          id?: string
          person_a?: string
          person_b?: string
          relationship?: Database["public"]["Enums"]["relationship_type"]
          start_year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "family_relationships_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_relationships_person_a_fkey"
            columns: ["person_a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_relationships_person_b_fkey"
            columns: ["person_b"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hobbies: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          kind: Database["public"]["Enums"]["invitation_kind"]
          profile_id: string | null
          recipient_label: string | null
          revoked_at: string | null
          revoked_by: string | null
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          kind: Database["public"]["Enums"]["invitation_kind"]
          profile_id?: string | null
          recipient_label?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["invitation_kind"]
          profile_id?: string | null
          recipient_label?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_branches: {
        Row: {
          branch_id: string
          is_primary: boolean
          profile_id: string
        }
        Insert: {
          branch_id: string
          is_primary?: boolean
          profile_id: string
        }
        Update: {
          branch_id?: string
          is_primary?: boolean
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_branches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "family_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_branches_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_hobbies: {
        Row: {
          hobby_id: string
          profile_id: string
        }
        Insert: {
          hobby_id: string
          profile_id: string
        }
        Update: {
          hobby_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_hobbies_hobby_id_fkey"
            columns: ["hobby_id"]
            isOneToOne: false
            referencedRelation: "hobbies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_hobbies_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_managers: {
        Row: {
          account_id: string
          granted_at: string
          granted_by: string | null
          id: string
          profile_id: string
          revoke_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          role: Database["public"]["Enums"]["manager_role"]
        }
        Insert: {
          account_id: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          profile_id: string
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          role?: Database["public"]["Enums"]["manager_role"]
        }
        Update: {
          account_id?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          profile_id?: string
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          role?: Database["public"]["Enums"]["manager_role"]
        }
        Relationships: [
          {
            foreignKeyName: "profile_managers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_managers_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_managers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_managers_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          kind: Database["public"]["Enums"]["request_kind"]
          message: string | null
          profile_id: string
          requester_id: string
          status: Database["public"]["Enums"]["request_status"]
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          kind: Database["public"]["Enums"]["request_kind"]
          message?: string | null
          profile_id: string
          requester_id: string
          status?: Database["public"]["Enums"]["request_status"]
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["request_kind"]
          message?: string | null
          profile_id?: string
          requester_id?: string
          status?: Database["public"]["Enums"]["request_status"]
        }
        Relationships: [
          {
            foreignKeyName: "profile_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_id: string | null
          aka: string | null
          archived_at: string | null
          birth_day: number | null
          birth_month: number | null
          birth_year: number | null
          birth_year_visibility: Database["public"]["Enums"]["visibility"]
          birthday_visibility: Database["public"]["Enums"]["visibility"]
          city: string | null
          contact_email: string | null
          created_at: string
          created_by: string | null
          email_visibility: Database["public"]["Enums"]["visibility"]
          full_name: string
          id: string
          import_key: string | null
          instagram: string | null
          is_living: boolean
          legacy: Json | null
          linkedin: string | null
          location_visibility: Database["public"]["Enums"]["visibility"]
          phone: string | null
          phone_visibility: Database["public"]["Enums"]["visibility"]
          photo_path: string | null
          photo_visibility: Database["public"]["Enums"]["visibility"]
          profile_type: Database["public"]["Enums"]["profile_type"]
          social_visibility: Database["public"]["Enums"]["visibility"]
          source: string
          state: string | null
          updated_at: string
          updated_by: string | null
          website: string | null
        }
        Insert: {
          account_id?: string | null
          aka?: string | null
          archived_at?: string | null
          birth_day?: number | null
          birth_month?: number | null
          birth_year?: number | null
          birth_year_visibility?: Database["public"]["Enums"]["visibility"]
          birthday_visibility?: Database["public"]["Enums"]["visibility"]
          city?: string | null
          contact_email?: string | null
          created_at?: string
          created_by?: string | null
          email_visibility?: Database["public"]["Enums"]["visibility"]
          full_name: string
          id?: string
          import_key?: string | null
          instagram?: string | null
          is_living?: boolean
          legacy?: Json | null
          linkedin?: string | null
          location_visibility?: Database["public"]["Enums"]["visibility"]
          phone?: string | null
          phone_visibility?: Database["public"]["Enums"]["visibility"]
          photo_path?: string | null
          photo_visibility?: Database["public"]["Enums"]["visibility"]
          profile_type?: Database["public"]["Enums"]["profile_type"]
          social_visibility?: Database["public"]["Enums"]["visibility"]
          source?: string
          state?: string | null
          updated_at?: string
          updated_by?: string | null
          website?: string | null
        }
        Update: {
          account_id?: string | null
          aka?: string | null
          archived_at?: string | null
          birth_day?: number | null
          birth_month?: number | null
          birth_year?: number | null
          birth_year_visibility?: Database["public"]["Enums"]["visibility"]
          birthday_visibility?: Database["public"]["Enums"]["visibility"]
          city?: string | null
          contact_email?: string | null
          created_at?: string
          created_by?: string | null
          email_visibility?: Database["public"]["Enums"]["visibility"]
          full_name?: string
          id?: string
          import_key?: string | null
          instagram?: string | null
          is_living?: boolean
          legacy?: Json | null
          linkedin?: string | null
          location_visibility?: Database["public"]["Enums"]["visibility"]
          phone?: string | null
          phone_visibility?: Database["public"]["Enums"]["visibility"]
          photo_path?: string | null
          photo_visibility?: Database["public"]["Enums"]["visibility"]
          profile_type?: Database["public"]["Enums"]["profile_type"]
          social_visibility?: Database["public"]["Enums"]["visibility"]
          source?: string
          state?: string | null
          updated_at?: string
          updated_by?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: { Args: { p_secret: string }; Returns: Json }
      admin_accounts: {
        Args: never
        Returns: {
          account_id: string
          created_at: string
          email: string
          full_name: string
          last_sign_in_at: string
          profile_id: string
          role: Database["public"]["Enums"]["account_role"]
          status: Database["public"]["Enums"]["account_status"]
        }[]
      }
      admin_add_guardian: {
        Args: { p_account_id: string; p_profile_id: string }
        Returns: undefined
      }
      admin_claim_requests: {
        Args: never
        Returns: {
          created_at: string
          id: string
          message: string
          profile_id: string
          profile_name: string
          requester_email: string
        }[]
      }
      admin_set_account_role: {
        Args: {
          p_account_id: string
          p_role: Database["public"]["Enums"]["account_role"]
        }
        Returns: undefined
      }
      admin_set_account_status: {
        Args: {
          p_account_id: string
          p_status: Database["public"]["Enums"]["account_status"]
        }
        Returns: undefined
      }
      admin_set_profile_status: {
        Args: {
          p_archived: boolean
          p_is_living: boolean
          p_profile_id: string
        }
        Returns: undefined
      }
      admin_unlink_profile: {
        Args: { p_profile_id: string }
        Returns: undefined
      }
      can_edit_profile: { Args: { p_profile_id: string }; Returns: boolean }
      cancel_profile_request: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      create_child_profile: {
        Args: {
          p_aka?: string
          p_birth_day?: number
          p_birth_month?: number
          p_birth_year: number
          p_full_name: string
          p_parent_detail?: string
        }
        Returns: string
      }
      create_invitation: {
        Args: {
          p_kind: Database["public"]["Enums"]["invitation_kind"]
          p_profile_id?: string
          p_recipient_label?: string
        }
        Returns: string
      }
      create_my_profile: {
        Args: {
          p_aka?: string
          p_branch_id?: string
          p_city?: string
          p_full_name: string
          p_state?: string
        }
        Returns: string
      }
      decide_profile_request: {
        Args: { p_approve: boolean; p_request_id: string }
        Returns: undefined
      }
      directory_profiles: {
        Args: never
        Returns: {
          aka: string
          birth_day: number
          birth_month: number
          birth_year: number
          can_edit: boolean
          city: string
          contact_email: string
          full_name: string
          id: string
          instagram: string
          is_claimed: boolean
          is_living: boolean
          is_me: boolean
          linkedin: string
          phone: string
          photo_path: string
          profile_type: Database["public"]["Enums"]["profile_type"]
          state: string
          updated_at: string
          website: string
        }[]
      }
      ensure_hobby: { Args: { p_name: string }; Returns: string }
      grant_guardian: {
        Args: { p_account_id: string; p_profile_id: string; p_via: string }
        Returns: undefined
      }
      invitation_preview: { Args: { p_secret: string }; Returns: Json }
      is_active_member: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_guardian_of: { Args: { p_profile_id: string }; Returns: boolean }
      is_valid_birthday: {
        Args: { d: number; m: number; y: number }
        Returns: boolean
      }
      link_profile_to_account: {
        Args: { p_account_id: string; p_profile_id: string; p_via: string }
        Returns: undefined
      }
      my_profile_id: { Args: never; Returns: string }
      pending_co_guardian_requests: {
        Args: { p_profile_id: string }
        Returns: {
          created_at: string
          id: string
          message: string
          requester_name: string
        }[]
      }
      profile_guardians: {
        Args: { p_profile_id: string }
        Returns: {
          account_id: string
          full_name: string
          granted_at: string
          is_me: boolean
        }[]
      }
      remove_guardian: {
        Args: { p_account_id: string; p_profile_id: string; p_reason?: string }
        Returns: undefined
      }
      request_co_guardianship: {
        Args: { p_message?: string; p_profile_id: string }
        Returns: string
      }
      request_profile_claim: {
        Args: { p_message?: string; p_profile_id: string }
        Returns: string
      }
      require_active_member: { Args: never; Returns: undefined }
      require_admin: { Args: never; Returns: undefined }
      revoke_invitation: {
        Args: { p_invitation_id: string }
        Returns: undefined
      }
      slugify: { Args: { value: string }; Returns: string }
      write_audit: {
        Args: {
          p_account_id?: string
          p_action: string
          p_details?: Json
          p_profile_id?: string
        }
        Returns: undefined
      }
    }
    Enums: {
      account_role: "member" | "admin"
      account_status: "pending" | "active" | "deactivated"
      invitation_kind: "join" | "claim" | "co_guardian"
      manager_role: "guardian"
      profile_type: "adult" | "child"
      relationship_type: "parent" | "partner"
      request_kind: "claim" | "co_guardian"
      request_status: "pending" | "approved" | "denied" | "cancelled"
      visibility: "members" | "private"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_role: ["member", "admin"],
      account_status: ["pending", "active", "deactivated"],
      invitation_kind: ["join", "claim", "co_guardian"],
      manager_role: ["guardian"],
      profile_type: ["adult", "child"],
      relationship_type: ["parent", "partner"],
      request_kind: ["claim", "co_guardian"],
      request_status: ["pending", "approved", "denied", "cancelled"],
      visibility: ["members", "private"],
    },
  },
} as const
