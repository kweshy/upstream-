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
      addresses: {
        Row: {
          block: string
          created_at: string
          gate_instructions: string
          house_number: string
          id: string
          is_default: boolean
          label: string
          user_id: string
        }
        Insert: {
          block?: string
          created_at?: string
          gate_instructions?: string
          house_number?: string
          id?: string
          is_default?: boolean
          label?: string
          user_id: string
        }
        Update: {
          block?: string
          created_at?: string
          gate_instructions?: string
          house_number?: string
          id?: string
          is_default?: boolean
          label?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bottle_ledger: {
        Row: {
          change: number
          created_at: string
          id: string
          order_id: string | null
          reason: string
          user_id: string
        }
        Insert: {
          change: number
          created_at?: string
          id?: string
          order_id?: string | null
          reason?: string
          user_id: string
        }
        Update: {
          change?: number
          created_at?: string
          id?: string
          order_id?: string | null
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bottle_ledger_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bottle_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_slots: {
        Row: {
          cutoff_minutes: number
          end_time: string
          id: string
          is_active: boolean
          label: string
          sort_order: number
          start_time: string
        }
        Insert: {
          cutoff_minutes?: number
          end_time: string
          id?: string
          is_active?: boolean
          label: string
          sort_order?: number
          start_time: string
        }
        Update: {
          cutoff_minutes?: number
          end_time?: string
          id?: string
          is_active?: boolean
          label?: string
          sort_order?: number
          start_time?: string
        }
        Relationships: []
      }
      notifications_log: {
        Row: {
          channel: string
          created_at: string
          id: string
          message: string
          order_id: string | null
          recipient: string
          status: string
          user_id: string | null
        }
        Insert: {
          channel?: string
          created_at?: string
          id?: string
          message: string
          order_id?: string | null
          recipient?: string
          status?: string
          user_id?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          message?: string
          order_id?: string | null
          recipient?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_log_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          deposit_kes: number
          id: string
          line_total: number
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          unit_price: number
        }
        Insert: {
          deposit_kes?: number
          id?: string
          line_total: number
          order_id: string
          product_id?: string | null
          product_name: string
          quantity: number
          unit_price: number
        }
        Update: {
          deposit_kes?: number
          id?: string
          line_total?: number
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          block: string
          cash_collected: number | null
          created_at: string
          delivered_at: string | null
          delivery_date: string
          delivery_fee_kes: number
          delivery_slot_id: string | null
          empties_collected: number
          gate_instructions: string
          house_number: string
          id: string
          notes: string
          order_number: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          rider_id: string | null
          status: Database["public"]["Enums"]["order_status"]
          total_kes: number
          updated_at: string
          user_id: string
        }
        Insert: {
          block?: string
          cash_collected?: number | null
          created_at?: string
          delivered_at?: string | null
          delivery_date?: string
          delivery_fee_kes?: number
          delivery_slot_id?: string | null
          empties_collected?: number
          gate_instructions?: string
          house_number?: string
          id?: string
          notes?: string
          order_number: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          rider_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total_kes: number
          updated_at?: string
          user_id: string
        }
        Update: {
          block?: string
          cash_collected?: number | null
          created_at?: string
          delivered_at?: string | null
          delivery_date?: string
          delivery_fee_kes?: number
          delivery_slot_id?: string | null
          empties_collected?: number
          gate_instructions?: string
          house_number?: string
          id?: string
          notes?: string
          order_number?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          rider_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total_kes?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_delivery_slot_id_fkey"
            columns: ["delivery_slot_id"]
            isOneToOne: false
            referencedRelation: "delivery_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          checkout_request_id: string | null
          confirmed_at: string | null
          created_at: string
          id: string
          merchant_request_id: string | null
          method: string
          mpesa_receipt: string | null
          order_id: string | null
          phone_number: string | null
          purpose: string
          status: Database["public"]["Enums"]["payment_status"]
          user_id: string | null
        }
        Insert: {
          amount: number
          checkout_request_id?: string | null
          confirmed_at?: string | null
          created_at?: string
          id?: string
          merchant_request_id?: string | null
          method?: string
          mpesa_receipt?: string | null
          order_id?: string | null
          phone_number?: string | null
          purpose?: string
          status?: Database["public"]["Enums"]["payment_status"]
          user_id?: string | null
        }
        Update: {
          amount?: number
          checkout_request_id?: string | null
          confirmed_at?: string | null
          created_at?: string
          id?: string
          merchant_request_id?: string | null
          method?: string
          mpesa_receipt?: string | null
          order_id?: string | null
          phone_number?: string | null
          purpose?: string
          status?: Database["public"]["Enums"]["payment_status"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string
          created_at: string
          deposit_kes: number
          description: string
          id: string
          is_active: boolean
          name: string
          price_kes: number
          size_label: string
          sort_order: number
        }
        Insert: {
          category?: string
          created_at?: string
          deposit_kes?: number
          description?: string
          id?: string
          is_active?: boolean
          name: string
          price_kes: number
          size_label?: string
          sort_order?: number
        }
        Update: {
          category?: string
          created_at?: string
          deposit_kes?: number
          description?: string
          id?: string
          is_active?: boolean
          name?: string
          price_kes?: number
          size_label?: string
          sort_order?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          block: string
          bottles_with_customer: number
          created_at: string
          full_name: string
          gate_instructions: string
          house_number: string
          id: string
          phone: string
          wallet_balance: number
        }
        Insert: {
          block?: string
          bottles_with_customer?: number
          created_at?: string
          full_name?: string
          gate_instructions?: string
          house_number?: string
          id: string
          phone?: string
          wallet_balance?: number
        }
        Update: {
          block?: string
          bottles_with_customer?: number
          created_at?: string
          full_name?: string
          gate_instructions?: string
          house_number?: string
          id?: string
          phone?: string
          wallet_balance?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          kind: string
          mpesa_receipt: string | null
          order_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          kind: string
          mpesa_receipt?: string | null
          order_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          kind?: string
          mpesa_receipt?: string | null
          order_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "rider" | "user"
      order_status:
        | "pending_payment"
        | "confirmed"
        | "packed"
        | "out_for_delivery"
        | "delivered"
        | "cancelled"
      payment_method:
        | "mpesa_stk"
        | "wallet"
        | "on_delivery_mpesa"
        | "on_delivery_cash"
      payment_status: "pending" | "success" | "failed"
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
      app_role: ["admin", "rider", "user"],
      order_status: [
        "pending_payment",
        "confirmed",
        "packed",
        "out_for_delivery",
        "delivered",
        "cancelled",
      ],
      payment_method: [
        "mpesa_stk",
        "wallet",
        "on_delivery_mpesa",
        "on_delivery_cash",
      ],
      payment_status: ["pending", "success", "failed"],
    },
  },
} as const
