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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      athlete_calibration: {
        Row: {
          id: string
          user_id: string
          sweat_coefficient: number
          sodium_coefficient: number
          water_coefficient: number
          pre_water_coefficient: number
          sodium_loss_modifier: number
          gi_tolerance_ceiling_ml_hr: number
          total_feedback_count: number
          condition_outcomes: Record<string, { better: number; same: number; worse: number }>
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          sweat_coefficient?: number
          sodium_coefficient?: number
          water_coefficient?: number
          pre_water_coefficient?: number
          sodium_loss_modifier?: number
          gi_tolerance_ceiling_ml_hr?: number
          total_feedback_count?: number
          condition_outcomes?: Record<string, { better: number; same: number; worse: number }>
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          sweat_coefficient?: number
          sodium_coefficient?: number
          water_coefficient?: number
          pre_water_coefficient?: number
          sodium_loss_modifier?: number
          gi_tolerance_ceiling_ml_hr?: number
          total_feedback_count?: number
          condition_outcomes?: Record<string, { better: number; same: number; worse: number }>
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      race_feedback: {
        Row: {
          id: string
          user_id: string
          race_id: string | null
          plan_id: string | null
          overall_rating: number | null
          issues: string[]
          water_feedback: string | null
          sodium_feedback: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          race_id?: string | null
          plan_id?: string | null
          overall_rating?: number | null
          issues?: string[]
          water_feedback?: string | null
          sodium_feedback?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          race_id?: string | null
          plan_id?: string | null
          overall_rating?: number | null
          issues?: string[]
          water_feedback?: string | null
          sodium_feedback?: string | null
          notes?: string | null
          created_at?: string
        }
        Relationships: []
      }
      athlete_races: {
        Row: {
          id: string
          user_id: string
          race_name: string
          race_date: string
          distance_km: number | null
          discipline: string | null
          location_city: string | null
          location_country: string | null
          latitude: number | null
          longitude: number | null
          plan_id: string | null
          notes: string | null
          status: string
          sent_reminders: Record<string, string>
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          race_name: string
          race_date: string
          distance_km?: number | null
          discipline?: string | null
          location_city?: string | null
          location_country?: string | null
          latitude?: number | null
          longitude?: number | null
          plan_id?: string | null
          notes?: string | null
          status?: string
          sent_reminders?: Record<string, string>
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          race_name?: string
          race_date?: string
          distance_km?: number | null
          discipline?: string | null
          location_city?: string | null
          location_country?: string | null
          latitude?: number | null
          longitude?: number | null
          plan_id?: string | null
          notes?: string | null
          status?: string
          sent_reminders?: Record<string, string>
          created_at?: string
        }
        Relationships: []
      }
      athlete_profiles: {
        Row: {
          id: string
          user_id: string
          full_name: string | null
          age: number | null
          sex: string | null
          height: number | null
          weight: number | null
          body_fat: number | null
          resting_heart_rate: number | null
          hrv: string | null
          sleep_hours: number | null
          sleep_quality: number | null
          sweat_rate: string | null
          sweat_saltiness: string | null
          known_sodium_loss: number | null
          strava_connected: boolean | null
          strava_refresh_token: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          full_name?: string | null
          age?: number | null
          sex?: string | null
          height?: number | null
          weight?: number | null
          body_fat?: number | null
          resting_heart_rate?: number | null
          hrv?: string | null
          sleep_hours?: number | null
          sleep_quality?: number | null
          sweat_rate?: string | null
          sweat_saltiness?: string | null
          known_sodium_loss?: number | null
          strava_connected?: boolean | null
          strava_refresh_token?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          full_name?: string | null
          age?: number | null
          sex?: string | null
          height?: number | null
          weight?: number | null
          body_fat?: number | null
          resting_heart_rate?: number | null
          hrv?: string | null
          sleep_hours?: number | null
          sleep_quality?: number | null
          sweat_rate?: string | null
          sweat_saltiness?: string | null
          known_sodium_loss?: number | null
          strava_connected?: boolean | null
          strava_refresh_token?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      hydration_profiles: {
        Row: {
          consent_given: boolean
          consent_timestamp: string | null
          created_at: string
          data_retention_expires_at: string | null
          deletion_token: string | null
          has_smartwatch_data: boolean | null
          id: string
          ip_address: unknown
          plan_data: Json | null
          profile_data: Json
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          consent_given?: boolean
          consent_timestamp?: string | null
          created_at?: string
          data_retention_expires_at?: string | null
          deletion_token?: string | null
          has_smartwatch_data?: boolean | null
          id?: string
          ip_address?: unknown
          plan_data?: Json | null
          profile_data: Json
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          consent_given?: boolean
          consent_timestamp?: string | null
          created_at?: string
          data_retention_expires_at?: string | null
          deletion_token?: string | null
          has_smartwatch_data?: boolean | null
          id?: string
          ip_address?: unknown
          plan_data?: Json | null
          profile_data?: Json
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_expired_hydration_profiles: { Args: never; Returns: undefined }
      get_all_hydration_profiles_admin: {
        Args: never
        Returns: {
          consent_given: boolean
          created_at: string
          has_smartwatch_data: boolean
          id: string
          ip_address: unknown
          plan_data: Json
          profile_data: Json
          user_email: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
