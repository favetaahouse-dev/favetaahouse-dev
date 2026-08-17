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
    PostgrestVersion: "14.15"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          city: string
          country: string
          full_name: string
          id: string
          is_default: boolean
          line1: string
          line2: string | null
          phone: string | null
          user_id: string
        }
        Insert: {
          city: string
          country?: string
          full_name: string
          id?: string
          is_default?: boolean
          line1: string
          line2?: string | null
          phone?: string | null
          user_id: string
        }
        Update: {
          city?: string
          country?: string
          full_name?: string
          id?: string
          is_default?: boolean
          line1?: string
          line2?: string | null
          phone?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          id: string
          ip: string | null
          metadata: Json
          resource_id: string | null
          resource_type: string | null
          summary: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          metadata?: Json
          resource_id?: string | null
          resource_type?: string | null
          summary?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          metadata?: Json
          resource_id?: string | null
          resource_type?: string | null
          summary?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          cart_id: string
          color_id: string | null
          fulfillment: string
          id: string
          length: number | null
          measure_unit: string | null
          measurements: Json | null
          notes: string | null
          product_id: string
          quantity: number
          tack_tack: boolean | null
          variant_id: string | null
        }
        Insert: {
          cart_id: string
          color_id?: string | null
          fulfillment?: string
          id?: string
          length?: number | null
          measure_unit?: string | null
          measurements?: Json | null
          notes?: string | null
          product_id: string
          quantity?: number
          tack_tack?: boolean | null
          variant_id?: string | null
        }
        Update: {
          cart_id?: string
          color_id?: string | null
          fulfillment?: string
          id?: string
          length?: number | null
          measure_unit?: string | null
          measurements?: Json | null
          notes?: string | null
          product_id?: string
          quantity?: number
          tack_tack?: boolean | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_color_id_fkey"
            columns: ["color_id"]
            isOneToOne: false
            referencedRelation: "product_colors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variants"
            referencedColumns: ["id"]
          },
        ]
      }
      carts: {
        Row: {
          coupon_code: string | null
          created_at: string
          currency: string
          id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          coupon_code?: string | null
          created_at?: string
          currency?: string
          id?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          coupon_code?: string | null
          created_at?: string
          currency?: string
          id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "carts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          handle: string
          id: string
          kind: string
          position: number
          title: string
          title_ar: string | null
        }
        Insert: {
          handle: string
          id?: string
          kind?: string
          position?: number
          title: string
          title_ar?: string | null
        }
        Update: {
          handle?: string
          id?: string
          kind?: string
          position?: number
          title?: string
          title_ar?: string | null
        }
        Relationships: []
      }
      content: {
        Row: {
          data: Json
          key: string
          updated_at: string
        }
        Insert: {
          data?: Json
          key: string
          updated_at?: string
        }
        Update: {
          data?: Json
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
      coupons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          expires_at: string | null
          id: string
          min_spend: number
          starts_at: string | null
          type: string
          usage_limit: number | null
          used_count: number
          value: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          expires_at?: string | null
          id?: string
          min_spend?: number
          starts_at?: string | null
          type?: string
          usage_limit?: number | null
          used_count?: number
          value: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          min_spend?: number
          starts_at?: string | null
          type?: string
          usage_limit?: number | null
          used_count?: number
          value?: number
        }
        Relationships: []
      }
      inventory_adjustments: {
        Row: {
          actor_email: string | null
          actor_id: string | null
          created_at: string
          delta: number
          id: string
          note: string | null
          order_id: string | null
          reason: string
          stock_after: number
          variant_id: string
        }
        Insert: {
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          delta: number
          id?: string
          note?: string | null
          order_id?: string | null
          reason?: string
          stock_after: number
          variant_id: string
        }
        Update: {
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          delta?: number
          id?: string
          note?: string | null
          order_id?: string | null
          reason?: string
          stock_after?: number
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_adjustments_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_adjustments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_adjustments_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variants"
            referencedColumns: ["id"]
          },
        ]
      }
      login_events: {
        Row: {
          created_at: string
          email: string | null
          id: string
          ip: string | null
          success: boolean
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          ip?: string | null
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          ip?: string | null
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "login_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          audience: string
          body: string | null
          created_at: string
          id: string
          level: string
          link: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          audience?: string
          body?: string | null
          created_at?: string
          id?: string
          level?: string
          link?: string | null
          read_at?: string | null
          title: string
          type?: string
          user_id?: string | null
        }
        Update: {
          audience?: string
          body?: string | null
          created_at?: string
          id?: string
          level?: string
          link?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          color: string
          fulfillment: string
          id: string
          image_url: string | null
          lead_max_days: number | null
          lead_min_days: number | null
          length: number | null
          measure_unit: string | null
          measurements: Json | null
          notes: string | null
          order_id: string
          price: number
          product_id: string | null
          quantity: number
          size: string | null
          sku: string | null
          tack_tack: boolean | null
          title: string
          variant_id: string | null
        }
        Insert: {
          color: string
          fulfillment?: string
          id?: string
          image_url?: string | null
          lead_max_days?: number | null
          lead_min_days?: number | null
          length?: number | null
          measure_unit?: string | null
          measurements?: Json | null
          notes?: string | null
          order_id: string
          price: number
          product_id?: string | null
          quantity: number
          size?: string | null
          sku?: string | null
          tack_tack?: boolean | null
          title: string
          variant_id?: string | null
        }
        Update: {
          color?: string
          fulfillment?: string
          id?: string
          image_url?: string | null
          lead_max_days?: number | null
          lead_min_days?: number | null
          length?: number | null
          measure_unit?: string | null
          measurements?: Json | null
          notes?: string | null
          order_id?: string
          price?: number
          product_id?: string | null
          quantity?: number
          size?: string | null
          sku?: string | null
          tack_tack?: boolean | null
          title?: string
          variant_id?: string | null
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
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          coupon_code: string | null
          created_at: string
          currency: string
          discount: number
          email: string
          id: string
          marketing_attribution: Json | null
          number: number
          paid_at: string | null
          payment_provider: string | null
          payment_ref: string | null
          shipping: number
          shipping_address: Json | null
          status: string
          subtotal: number
          tax: number
          total: number
          tracking_number: string | null
          user_id: string | null
        }
        Insert: {
          coupon_code?: string | null
          created_at?: string
          currency?: string
          discount?: number
          email: string
          id?: string
          marketing_attribution?: Json | null
          number?: never
          paid_at?: string | null
          payment_provider?: string | null
          payment_ref?: string | null
          shipping?: number
          shipping_address?: Json | null
          status?: string
          subtotal: number
          tax?: number
          total: number
          tracking_number?: string | null
          user_id?: string | null
        }
        Update: {
          coupon_code?: string | null
          created_at?: string
          currency?: string
          discount?: number
          email?: string
          id?: string
          marketing_attribution?: Json | null
          number?: never
          paid_at?: string | null
          payment_provider?: string | null
          payment_ref?: string | null
          shipping?: number
          shipping_address?: Json | null
          status?: string
          subtotal?: number
          tax?: number
          total?: number
          tracking_number?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          cart_id: string | null
          created_at: string
          currency: string
          id: string
          order_id: string
          provider: string
          provider_payment_id: string | null
          raw: Json | null
          status: string
          status_id: number | null
          transaction_id: string | null
          uid: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          cart_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          order_id: string
          provider: string
          provider_payment_id?: string | null
          raw?: Json | null
          status?: string
          status_id?: number | null
          transaction_id?: string | null
          uid?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          cart_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          order_id?: string
          provider?: string
          provider_payment_id?: string | null
          raw?: Json | null
          status?: string
          status_id?: number | null
          transaction_id?: string | null
          uid?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      product_collections: {
        Row: {
          collection_id: string
          position: number
          product_id: string
        }
        Insert: {
          collection_id: string
          position?: number
          product_id: string
        }
        Update: {
          collection_id?: string
          position?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_collections_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_collections_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_colors: {
        Row: {
          hex: string | null
          id: string
          image_url: string | null
          name: string
          name_ar: string | null
          position: number
          product_id: string
        }
        Insert: {
          hex?: string | null
          id?: string
          image_url?: string | null
          name: string
          name_ar?: string | null
          position?: number
          product_id: string
        }
        Update: {
          hex?: string | null
          id?: string
          image_url?: string | null
          name?: string
          name_ar?: string | null
          position?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_colors_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          alt: string | null
          color_key: string | null
          id: string
          position: number
          product_id: string
          url: string
        }
        Insert: {
          alt?: string | null
          color_key?: string | null
          id?: string
          position?: number
          product_id: string
          url: string
        }
        Update: {
          alt?: string | null
          color_key?: string | null
          id?: string
          position?: number
          product_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string
          created_at: string
          description: string | null
          description_ar: string | null
          details: string | null
          details_ar: string | null
          featured: boolean
          fulfillment: string
          handle: string
          id: string
          materials: string | null
          materials_ar: string | null
          model_size: string | null
          mto_compare_at: number | null
          mto_fields: string[]
          mto_lead_max: number | null
          mto_lead_min: number | null
          mto_price: number | null
          on_sale: boolean
          packaging: string | null
          price_max: number
          price_min: number
          product_code: string | null
          status: string
          tags: string[]
          title: string
          title_ar: string | null
          total_qty: number
          updated_at: string
          vendor: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          description_ar?: string | null
          details?: string | null
          details_ar?: string | null
          featured?: boolean
          fulfillment?: string
          handle: string
          id?: string
          materials?: string | null
          materials_ar?: string | null
          model_size?: string | null
          mto_compare_at?: number | null
          mto_fields?: string[]
          mto_lead_max?: number | null
          mto_lead_min?: number | null
          mto_price?: number | null
          on_sale?: boolean
          packaging?: string | null
          price_max?: number
          price_min?: number
          product_code?: string | null
          status?: string
          tags?: string[]
          title: string
          title_ar?: string | null
          total_qty?: number
          updated_at?: string
          vendor?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          description_ar?: string | null
          details?: string | null
          details_ar?: string | null
          featured?: boolean
          fulfillment?: string
          handle?: string
          id?: string
          materials?: string | null
          materials_ar?: string | null
          model_size?: string | null
          mto_compare_at?: number | null
          mto_fields?: string[]
          mto_lead_max?: number | null
          mto_lead_min?: number | null
          mto_price?: number | null
          on_sale?: boolean
          packaging?: string | null
          price_max?: number
          price_min?: number
          product_code?: string | null
          status?: string
          tags?: string[]
          title?: string
          title_ar?: string | null
          total_qty?: number
          updated_at?: string
          vendor?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          bucket: string
          count: number
          expires_at: string
        }
        Insert: {
          bucket: string
          count?: number
          expires_at: string
        }
        Update: {
          bucket?: string
          count?: number
          expires_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          permission: string
          role_id: string
        }
        Insert: {
          permission: string
          role_id: string
        }
        Update: {
          permission?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          key: string
          name: string
          rank: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          key: string
          name: string
          rank?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          key?: string
          name?: string
          rank?: number
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string
          email: string
          email_verified: string | null
          id: string
          image: string | null
          name: string | null
          password: string | null
          role: string
          role_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          email_verified?: string | null
          id?: string
          image?: string | null
          name?: string | null
          password?: string | null
          role?: string
          role_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          email_verified?: string | null
          id?: string
          image?: string | null
          name?: string | null
          password?: string | null
          role?: string
          role_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      variants: {
        Row: {
          available: boolean
          color: string
          color_hex: string | null
          color_id: string
          compare_at: number | null
          id: string
          image_url: string | null
          length: number
          position: number
          price: number
          product_id: string
          shopify_id: string | null
          size: string
          sku: string | null
          stock: number
          tack_tack: boolean
        }
        Insert: {
          available?: boolean
          color: string
          color_hex?: string | null
          color_id: string
          compare_at?: number | null
          id?: string
          image_url?: string | null
          length?: number
          position?: number
          price: number
          product_id: string
          shopify_id?: string | null
          size: string
          sku?: string | null
          stock?: number
          tack_tack?: boolean
        }
        Update: {
          available?: boolean
          color?: string
          color_hex?: string | null
          color_id?: string
          compare_at?: number | null
          id?: string
          image_url?: string | null
          length?: number
          position?: number
          price?: number
          product_id?: string
          shopify_id?: string | null
          size?: string
          sku?: string | null
          stock?: number
          tack_tack?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "variants_color_id_fkey"
            columns: ["color_id"]
            isOneToOne: false
            referencedRelation: "product_colors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      variants_backup_20260717: {
        Row: {
          available: boolean | null
          color: string | null
          color_hex: string | null
          compare_at: number | null
          id: string | null
          image_url: string | null
          position: number | null
          price: number | null
          product_id: string | null
          shopify_id: string | null
          size: string | null
          sku: string | null
          stock: number | null
        }
        Insert: {
          available?: boolean | null
          color?: string | null
          color_hex?: string | null
          compare_at?: number | null
          id?: string | null
          image_url?: string | null
          position?: number | null
          price?: number | null
          product_id?: string | null
          shopify_id?: string | null
          size?: string | null
          sku?: string | null
          stock?: number | null
        }
        Update: {
          available?: boolean | null
          color?: string | null
          color_hex?: string | null
          compare_at?: number | null
          id?: string | null
          image_url?: string | null
          position?: number | null
          price?: number | null
          product_id?: string | null
          shopify_id?: string | null
          size?: string | null
          sku?: string | null
          stock?: number | null
        }
        Relationships: []
      }
      wishlist_items: {
        Row: {
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlist_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      adjust_stock: {
        Args: {
          p_actor_email?: string
          p_actor_id?: string
          p_delta: number
          p_note?: string
          p_order_id?: string
          p_reason?: string
          p_set?: number
          p_variant_id: string
        }
        Returns: number
      }
      adjust_stock_bulk: {
        Args: {
          p_actor_email?: string
          p_actor_id?: string
          p_reason?: string
          p_rows: Json
        }
        Returns: number
      }
      admin_order_analytics: { Args: { p_days: number }; Returns: Json }
      collection_color_facets: {
        Args: { p_ids: string[] }
        Returns: {
          color: string
          hex: string
          product_count: number
        }[]
      }
      create_order: {
        Args: {
          p_address: Json
          p_coupon?: string
          p_currency: string
          p_email: string
          p_items: Json
          p_user_id: string
        }
        Returns: Json
      }
      generate_variants: {
        Args: {
          p_color_ids: string[]
          p_price: number
          p_product_id: string
          p_sizes: string[]
          p_stock: number
        }
        Returns: number
      }
      mark_order_paid: {
        Args: {
          p_cart_id?: string
          p_order_id: string
          p_provider?: string
          p_reference?: string
        }
        Returns: boolean
      }
      price_range: {
        Args: never
        Returns: {
          max: number
          min: number
        }[]
      }
      rate_limit_hit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number }
        Returns: boolean
      }
      recompute_product_prices: {
        Args: { p_product_id: string }
        Returns: undefined
      }
      variant_product_ids: {
        Args: { p_color: string; p_in_stock: boolean }
        Returns: string[]
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
