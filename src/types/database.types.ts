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
      accounts: {
        Row: {
          archived_at: string | null
          balance: number
          classification: string
          created_at: string
          currency: string
          id: string
          is_active: boolean
          last_four: string | null
          name: string
          type: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          balance?: number
          classification?: string
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          last_four?: string | null
          name: string
          type: string
          user_id?: string
        }
        Update: {
          archived_at?: string | null
          balance?: number
          classification?: string
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          last_four?: string | null
          name?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      binance_integrations: {
        Row: {
          api_key: string
          api_secret: string
          auto_sync: boolean
          created_at: string
          id: string
          is_active: boolean
          last_synced_at: string | null
          sync_error: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key: string
          api_secret: string
          auto_sync?: boolean
          created_at?: string
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          sync_error?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key?: string
          api_secret?: string
          auto_sync?: boolean
          created_at?: string
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          sync_error?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bond_holdings: {
        Row: {
          avg_buy_price: number
          bond_type: string
          coupon_frequency: string
          coupon_rate: number
          created_at: string
          credit_rating: string | null
          current_price: number | null
          demat_account_id: string | null
          demat_broker: string
          face_value: number
          id: string
          invested_amount: number
          isin: string
          issue_date: string | null
          issuer_name: string
          maturity_date: string
          name: string
          next_coupon_date: string | null
          notes: string | null
          order_reference: string | null
          platform: string
          quantity: number
          rating_agency: string | null
          seniority: string
          tax_status: string
          updated_at: string
          user_id: string
          ytm: number | null
        }
        Insert: {
          avg_buy_price?: number
          bond_type?: string
          coupon_frequency?: string
          coupon_rate?: number
          created_at?: string
          credit_rating?: string | null
          current_price?: number | null
          demat_account_id?: string | null
          demat_broker?: string
          face_value?: number
          id?: string
          invested_amount?: number
          isin: string
          issue_date?: string | null
          issuer_name: string
          maturity_date: string
          name: string
          next_coupon_date?: string | null
          notes?: string | null
          order_reference?: string | null
          platform?: string
          quantity?: number
          rating_agency?: string | null
          seniority?: string
          tax_status?: string
          updated_at?: string
          user_id?: string
          ytm?: number | null
        }
        Update: {
          avg_buy_price?: number
          bond_type?: string
          coupon_frequency?: string
          coupon_rate?: number
          created_at?: string
          credit_rating?: string | null
          current_price?: number | null
          demat_account_id?: string | null
          demat_broker?: string
          face_value?: number
          id?: string
          invested_amount?: number
          isin?: string
          issue_date?: string | null
          issuer_name?: string
          maturity_date?: string
          name?: string
          next_coupon_date?: string | null
          notes?: string | null
          order_reference?: string | null
          platform?: string
          quantity?: number
          rating_agency?: string | null
          seniority?: string
          tax_status?: string
          updated_at?: string
          user_id?: string
          ytm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bond_holdings_demat_account_id_fkey"
            columns: ["demat_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      bond_transactions: {
        Row: {
          amount: number
          created_at: string
          demat_account_id: string | null
          holding_id: string | null
          id: string
          isin: string
          notes: string | null
          platform: string
          price: number
          quantity: number
          transaction_date: string
          type: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          demat_account_id?: string | null
          holding_id?: string | null
          id?: string
          isin: string
          notes?: string | null
          platform?: string
          price?: number
          quantity?: number
          transaction_date?: string
          type: string
          user_id?: string
        }
        Update: {
          amount?: number
          created_at?: string
          demat_account_id?: string | null
          holding_id?: string | null
          id?: string
          isin?: string
          notes?: string | null
          platform?: string
          price?: number
          quantity?: number
          transaction_date?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bond_transactions_demat_account_id_fkey"
            columns: ["demat_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bond_transactions_holding_id_fkey"
            columns: ["holding_id"]
            isOneToOne: false
            referencedRelation: "bond_holdings"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          alert_threshold: number
          amount: number
          category: string
          created_at: string
          id: string
          month_year: string
          notes: string | null
          period: string
          user_id: string
        }
        Insert: {
          alert_threshold?: number
          amount?: number
          category: string
          created_at?: string
          id?: string
          month_year?: string
          notes?: string | null
          period?: string
          user_id?: string
        }
        Update: {
          alert_threshold?: number
          amount?: number
          category?: string
          created_at?: string
          id?: string
          month_year?: string
          notes?: string | null
          period?: string
          user_id?: string
        }
        Relationships: []
      }
      bullion_holdings: {
        Row: {
          account_id: string | null
          buy_price_per_gram: number
          cert_id: string | null
          created_at: string
          id: string
          item_type: string
          making_charges: number
          metal: string
          name: string
          notes: string | null
          purchase_date: string
          purity: string
          purity_percentage: number
          quantity: number
          storage_location: string
          tax_gst: number
          total_buy_price: number
          updated_at: string
          user_id: string
          weight_grams: number
        }
        Insert: {
          account_id?: string | null
          buy_price_per_gram: number
          cert_id?: string | null
          created_at?: string
          id?: string
          item_type?: string
          making_charges?: number
          metal: string
          name: string
          notes?: string | null
          purchase_date?: string
          purity: string
          purity_percentage?: number
          quantity?: number
          storage_location?: string
          tax_gst?: number
          total_buy_price: number
          updated_at?: string
          user_id?: string
          weight_grams: number
        }
        Update: {
          account_id?: string | null
          buy_price_per_gram?: number
          cert_id?: string | null
          created_at?: string
          id?: string
          item_type?: string
          making_charges?: number
          metal?: string
          name?: string
          notes?: string | null
          purchase_date?: string
          purity?: string
          purity_percentage?: number
          quantity?: number
          storage_location?: string
          tax_gst?: number
          total_buy_price?: number
          updated_at?: string
          user_id?: string
          weight_grams?: number
        }
        Relationships: [
          {
            foreignKeyName: "bullion_holdings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      bullion_transactions: {
        Row: {
          created_at: string
          holding_id: string | null
          id: string
          making_charges: number
          metal: string
          notes: string | null
          price_per_gram: number
          tax_gst: number
          total_amount: number
          transaction_date: string
          type: string
          user_id: string
          weight_grams: number
        }
        Insert: {
          created_at?: string
          holding_id?: string | null
          id?: string
          making_charges?: number
          metal: string
          notes?: string | null
          price_per_gram: number
          tax_gst?: number
          total_amount: number
          transaction_date?: string
          type: string
          user_id?: string
          weight_grams: number
        }
        Update: {
          created_at?: string
          holding_id?: string | null
          id?: string
          making_charges?: number
          metal?: string
          notes?: string | null
          price_per_gram?: number
          tax_gst?: number
          total_amount?: number
          transaction_date?: string
          type?: string
          user_id?: string
          weight_grams?: number
        }
        Relationships: [
          {
            foreignKeyName: "bullion_transactions_holding_id_fkey"
            columns: ["holding_id"]
            isOneToOne: false
            referencedRelation: "bullion_holdings"
            referencedColumns: ["id"]
          },
        ]
      }
      crypto_holdings: {
        Row: {
          asset: string
          change_24h: number
          created_at: string
          current_price_usd: number
          free_amount: number
          id: string
          last_synced_at: string
          locked_amount: number
          name: string
          total_quantity: number
          total_value_usd: number
          updated_at: string
          user_id: string
        }
        Insert: {
          asset: string
          change_24h?: number
          created_at?: string
          current_price_usd?: number
          free_amount?: number
          id?: string
          last_synced_at?: string
          locked_amount?: number
          name?: string
          total_quantity?: number
          total_value_usd?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          asset?: string
          change_24h?: number
          created_at?: string
          current_price_usd?: number
          free_amount?: number
          id?: string
          last_synced_at?: string
          locked_amount?: number
          name?: string
          total_quantity?: number
          total_value_usd?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      crypto_trades: {
        Row: {
          commission: number
          commission_asset: string
          created_at: string
          executed_at: string
          id: string
          is_buyer: boolean
          is_maker: boolean
          order_id: number
          price: number
          qty: number
          quote_qty: number
          side: string
          symbol: string
          trade_id: number
          user_id: string
        }
        Insert: {
          commission?: number
          commission_asset?: string
          created_at?: string
          executed_at: string
          id?: string
          is_buyer: boolean
          is_maker?: boolean
          order_id: number
          price?: number
          qty?: number
          quote_qty?: number
          side: string
          symbol: string
          trade_id: number
          user_id?: string
        }
        Update: {
          commission?: number
          commission_asset?: string
          created_at?: string
          executed_at?: string
          id?: string
          is_buyer?: boolean
          is_maker?: boolean
          order_id?: number
          price?: number
          qty?: number
          quote_qty?: number
          side?: string
          symbol?: string
          trade_id?: number
          user_id?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          account_id: string | null
          amount: number
          category: string
          created_at: string
          currency: string
          expense_date: string
          id: string
          notes: string | null
          recurring_rule_id: string | null
          tags: string[]
          title: string
          transaction_type: string
          transfer_id: string | null
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount?: number
          category?: string
          created_at?: string
          currency?: string
          expense_date?: string
          id?: string
          notes?: string | null
          recurring_rule_id?: string | null
          tags?: string[]
          title: string
          transaction_type?: string
          transfer_id?: string | null
          user_id?: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category?: string
          created_at?: string
          currency?: string
          expense_date?: string
          id?: string
          notes?: string | null
          recurring_rule_id?: string | null
          tags?: string[]
          title?: string
          transaction_type?: string
          transfer_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      family_emergency_vault: {
        Row: {
          contact_number: string | null
          created_at: string
          id: string
          notes: string | null
          provider_or_name: string
          reference_number: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          contact_number?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          provider_or_name: string
          reference_number?: string | null
          title: string
          type?: string
          user_id?: string
        }
        Update: {
          contact_number?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          provider_or_name?: string
          reference_number?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      family_goals: {
        Row: {
          assigned_members: Json | null
          category: string
          created_at: string
          current_amount: number
          icon: string
          id: string
          notes: string | null
          status: string
          target_amount: number
          target_date: string | null
          title: string
          user_id: string
        }
        Insert: {
          assigned_members?: Json | null
          category?: string
          created_at?: string
          current_amount?: number
          icon?: string
          id?: string
          notes?: string | null
          status?: string
          target_amount?: number
          target_date?: string | null
          title: string
          user_id?: string
        }
        Update: {
          assigned_members?: Json | null
          category?: string
          created_at?: string
          current_amount?: number
          icon?: string
          id?: string
          notes?: string | null
          status?: string
          target_amount?: number
          target_date?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      family_members: {
        Row: {
          avatar_color: string
          created_at: string
          current_spending: number
          email: string | null
          id: string
          monthly_allowance: number
          name: string
          notes: string | null
          phone: string | null
          relationship: string
          role: string
          telegram_chat_id: string | null
          telegram_username: string | null
          user_id: string
        }
        Insert: {
          avatar_color?: string
          created_at?: string
          current_spending?: number
          email?: string | null
          id?: string
          monthly_allowance?: number
          name: string
          notes?: string | null
          phone?: string | null
          relationship?: string
          role?: string
          telegram_chat_id?: string | null
          telegram_username?: string | null
          user_id?: string
        }
        Update: {
          avatar_color?: string
          created_at?: string
          current_spending?: number
          email?: string | null
          id?: string
          monthly_allowance?: number
          name?: string
          notes?: string | null
          phone?: string | null
          relationship?: string
          role?: string
          telegram_chat_id?: string | null
          telegram_username?: string | null
          user_id?: string
        }
        Relationships: []
      }
      family_responsibilities: {
        Row: {
          amount: number
          assigned_to: string | null
          category: string
          created_at: string
          due_date: string | null
          frequency: string
          id: string
          is_completed: boolean
          notes: string | null
          title: string
          user_id: string
        }
        Insert: {
          amount?: number
          assigned_to?: string | null
          category?: string
          created_at?: string
          due_date?: string | null
          frequency?: string
          id?: string
          is_completed?: boolean
          notes?: string | null
          title: string
          user_id?: string
        }
        Update: {
          amount?: number
          assigned_to?: string | null
          category?: string
          created_at?: string
          due_date?: string | null
          frequency?: string
          id?: string
          is_completed?: boolean
          notes?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      financial_audit_logs: {
        Row: {
          action: string
          created_at: string
          delta_amount: number | null
          entity_id: string
          entity_type: string
          id: string
          new_state: Json | null
          old_state: Json | null
          performed_by: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          delta_amount?: number | null
          entity_id: string
          entity_type: string
          id?: string
          new_state?: Json | null
          old_state?: Json | null
          performed_by?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          delta_amount?: number | null
          entity_id?: string
          entity_type?: string
          id?: string
          new_state?: Json | null
          old_state?: Json | null
          performed_by?: string
          user_id?: string
        }
        Relationships: []
      }
      fno_positions: {
        Row: {
          account_id: string | null
          avg_price: number
          created_at: string
          exit_date: string | null
          exit_price: number | null
          expiry_date: string
          id: string
          instrument_type: string
          lot_size: number
          lots: number
          ltp: number | null
          notes: string | null
          product: string
          quantity: number
          side: string
          status: string
          stop_loss: number | null
          strategy_name: string | null
          strike_price: number | null
          symbol: string
          target_price: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          avg_price?: number
          created_at?: string
          exit_date?: string | null
          exit_price?: number | null
          expiry_date: string
          id?: string
          instrument_type: string
          lot_size?: number
          lots?: number
          ltp?: number | null
          notes?: string | null
          product?: string
          quantity: number
          side: string
          status?: string
          stop_loss?: number | null
          strategy_name?: string | null
          strike_price?: number | null
          symbol: string
          target_price?: number | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          account_id?: string | null
          avg_price?: number
          created_at?: string
          exit_date?: string | null
          exit_price?: number | null
          expiry_date?: string
          id?: string
          instrument_type?: string
          lot_size?: number
          lots?: number
          ltp?: number | null
          notes?: string | null
          product?: string
          quantity?: number
          side?: string
          status?: string
          stop_loss?: number | null
          strategy_name?: string | null
          strike_price?: number | null
          symbol?: string
          target_price?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fno_positions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      fno_trades: {
        Row: {
          action: string
          brokerage: number | null
          created_at: string
          exchange_charges: number | null
          expiry_date: string
          gst: number | null
          id: string
          instrument_type: string
          notes: string | null
          pnl: number | null
          position_id: string | null
          price: number
          quantity: number
          side: string
          strike_price: number | null
          stt: number | null
          symbol: string
          trade_date: string
          user_id: string
        }
        Insert: {
          action?: string
          brokerage?: number | null
          created_at?: string
          exchange_charges?: number | null
          expiry_date: string
          gst?: number | null
          id?: string
          instrument_type: string
          notes?: string | null
          pnl?: number | null
          position_id?: string | null
          price: number
          quantity: number
          side: string
          strike_price?: number | null
          stt?: number | null
          symbol: string
          trade_date?: string
          user_id?: string
        }
        Update: {
          action?: string
          brokerage?: number | null
          created_at?: string
          exchange_charges?: number | null
          expiry_date?: string
          gst?: number | null
          id?: string
          instrument_type?: string
          notes?: string | null
          pnl?: number | null
          position_id?: string | null
          price?: number
          quantity?: number
          side?: string
          strike_price?: number | null
          stt?: number | null
          symbol?: string
          trade_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fno_trades_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "fno_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      income: {
        Row: {
          account_id: string | null
          amount: number
          category: string
          created_at: string
          currency: string
          frequency: string
          id: string
          notes: string | null
          received_date: string
          recurring_rule_id: string | null
          tags: string[]
          title: string
          transaction_type: string
          transfer_id: string | null
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount?: number
          category?: string
          created_at?: string
          currency?: string
          frequency?: string
          id?: string
          notes?: string | null
          received_date?: string
          recurring_rule_id?: string | null
          tags?: string[]
          title: string
          transaction_type?: string
          transfer_id?: string | null
          user_id?: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category?: string
          created_at?: string
          currency?: string
          frequency?: string
          id?: string
          notes?: string | null
          received_date?: string
          recurring_rule_id?: string | null
          tags?: string[]
          title?: string
          transaction_type?: string
          transfer_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "income_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      mutual_fund_holdings: {
        Row: {
          account_id: string | null
          avg_nav: number
          category: string
          created_at: string
          current_nav: number
          dividend_option: string
          folio_number: string
          fund_house: string
          id: string
          invested_amount: number
          is_sip_active: boolean
          isin: string | null
          nav_date: string | null
          notes: string | null
          plan_type: string
          previous_nav: number | null
          scheme_code: string
          scheme_name: string
          sip_amount: number | null
          sip_day: number | null
          sip_frequency: string | null
          sip_step_up_percent: number | null
          sub_category: string | null
          units: number
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          avg_nav?: number
          category?: string
          created_at?: string
          current_nav?: number
          dividend_option?: string
          folio_number?: string
          fund_house?: string
          id?: string
          invested_amount?: number
          is_sip_active?: boolean
          isin?: string | null
          nav_date?: string | null
          notes?: string | null
          plan_type?: string
          previous_nav?: number | null
          scheme_code: string
          scheme_name: string
          sip_amount?: number | null
          sip_day?: number | null
          sip_frequency?: string | null
          sip_step_up_percent?: number | null
          sub_category?: string | null
          units?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          account_id?: string | null
          avg_nav?: number
          category?: string
          created_at?: string
          current_nav?: number
          dividend_option?: string
          folio_number?: string
          fund_house?: string
          id?: string
          invested_amount?: number
          is_sip_active?: boolean
          isin?: string | null
          nav_date?: string | null
          notes?: string | null
          plan_type?: string
          previous_nav?: number | null
          scheme_code?: string
          scheme_name?: string
          sip_amount?: number | null
          sip_day?: number | null
          sip_frequency?: string | null
          sip_step_up_percent?: number | null
          sub_category?: string | null
          units?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mutual_fund_holdings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      mutual_fund_transactions: {
        Row: {
          amount: number
          created_at: string
          holding_id: string | null
          id: string
          nav: number
          notes: string | null
          scheme_code: string
          scheme_name: string
          stamp_duty: number | null
          transaction_date: string
          type: string
          units: number
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          holding_id?: string | null
          id?: string
          nav: number
          notes?: string | null
          scheme_code: string
          scheme_name: string
          stamp_duty?: number | null
          transaction_date?: string
          type: string
          units: number
          user_id?: string
        }
        Update: {
          amount?: number
          created_at?: string
          holding_id?: string | null
          id?: string
          nav?: number
          notes?: string | null
          scheme_code?: string
          scheme_name?: string
          stamp_duty?: number | null
          transaction_date?: string
          type?: string
          units?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mutual_fund_transactions_holding_id_fkey"
            columns: ["holding_id"]
            isOneToOne: false
            referencedRelation: "mutual_fund_holdings"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_rules: {
        Row: {
          amount: number
          category: string
          created_at: string
          frequency: string
          from_account_id: string | null
          id: string
          is_active: boolean
          last_run_date: string | null
          next_run_date: string
          notes: string | null
          start_date: string
          title: string
          to_account_id: string | null
          transaction_type: string
          user_id: string
        }
        Insert: {
          amount: number
          category?: string
          created_at?: string
          frequency: string
          from_account_id?: string | null
          id?: string
          is_active?: boolean
          last_run_date?: string | null
          next_run_date: string
          notes?: string | null
          start_date?: string
          title: string
          to_account_id?: string | null
          transaction_type: string
          user_id?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          frequency?: string
          from_account_id?: string | null
          id?: string
          is_active?: boolean
          last_run_date?: string | null
          next_run_date?: string
          notes?: string | null
          start_date?: string
          title?: string
          to_account_id?: string | null
          transaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_rules_from_account_id_fkey"
            columns: ["from_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_rules_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_holdings: {
        Row: {
          account_id: string | null
          avg_buy_price: number
          company_name: string
          created_at: string
          currency: string
          exchange: string
          id: string
          notes: string | null
          quantity: number
          sector: string | null
          stop_loss: number | null
          symbol: string
          target_price: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          avg_buy_price?: number
          company_name: string
          created_at?: string
          currency?: string
          exchange?: string
          id?: string
          notes?: string | null
          quantity?: number
          sector?: string | null
          stop_loss?: number | null
          symbol: string
          target_price?: number | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          account_id?: string | null
          avg_buy_price?: number
          company_name?: string
          created_at?: string
          currency?: string
          exchange?: string
          id?: string
          notes?: string | null
          quantity?: number
          sector?: string | null
          stop_loss?: number | null
          symbol?: string
          target_price?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_holdings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transactions: {
        Row: {
          brokerage_charges: number | null
          created_at: string
          exchange: string
          holding_id: string | null
          id: string
          notes: string | null
          price: number
          quantity: number
          symbol: string
          transaction_date: string
          type: string
          user_id: string
        }
        Insert: {
          brokerage_charges?: number | null
          created_at?: string
          exchange?: string
          holding_id?: string | null
          id?: string
          notes?: string | null
          price: number
          quantity: number
          symbol: string
          transaction_date?: string
          type: string
          user_id?: string
        }
        Update: {
          brokerage_charges?: number | null
          created_at?: string
          exchange?: string
          holding_id?: string | null
          id?: string
          notes?: string | null
          price?: number
          quantity?: number
          symbol?: string
          transaction_date?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transactions_holding_id_fkey"
            columns: ["holding_id"]
            isOneToOne: false
            referencedRelation: "stock_holdings"
            referencedColumns: ["id"]
          },
        ]
      }
      transfers: {
        Row: {
          amount: number
          created_at: string
          currency: string
          from_account_id: string
          id: string
          notes: string | null
          to_account_id: string
          transfer_date: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          from_account_id: string
          id?: string
          notes?: string | null
          to_account_id: string
          transfer_date?: string
          user_id?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          from_account_id?: string
          id?: string
          notes?: string | null
          to_account_id?: string
          transfer_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfers_from_account_id_fkey"
            columns: ["from_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          id: string
          name: string
          telegram_chat_id: string | null
          telegram_link_token: string | null
          telegram_linked_at: string | null
          telegram_username: string | null
          theme: string
          updated_at: string
        }
        Insert: {
          id?: string
          name?: string
          telegram_chat_id?: string | null
          telegram_link_token?: string | null
          telegram_linked_at?: string | null
          telegram_username?: string | null
          theme?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          telegram_chat_id?: string | null
          telegram_link_token?: string | null
          telegram_linked_at?: string | null
          telegram_username?: string | null
          theme?: string
          updated_at?: string
        }
        Relationships: []
      }
      zerodha_integrations: {
        Row: {
          access_token: string | null
          api_key: string
          api_secret: string
          created_at: string
          id: string
          is_active: boolean
          last_sync_at: string | null
          last_sync_error: string | null
          last_sync_status: string | null
          last_sync_summary: Json | null
          public_token: string | null
          request_token: string | null
          token_generated_at: string | null
          updated_at: string
          user_id: string
          user_profile: Json | null
        }
        Insert: {
          access_token?: string | null
          api_key: string
          api_secret: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          last_sync_summary?: Json | null
          public_token?: string | null
          request_token?: string | null
          token_generated_at?: string | null
          updated_at?: string
          user_id?: string
          user_profile?: Json | null
        }
        Update: {
          access_token?: string | null
          api_key?: string
          api_secret?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          last_sync_summary?: Json | null
          public_token?: string | null
          request_token?: string | null
          token_generated_at?: string | null
          updated_at?: string
          user_id?: string
          user_profile?: Json | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      decrement_account_balance: {
        Args: { p_account_id: string; p_amount: number; p_user_id: string }
        Returns: number
      }
      fn_delete_expense_atomic: {
        Args: { p_expense_id: string; p_user_id: string }
        Returns: Json
      }
      fn_delete_income_atomic: {
        Args: { p_income_id: string; p_user_id: string }
        Returns: Json
      }
      fn_delete_transfer_atomic: {
        Args: { p_transfer_id: string; p_user_id: string }
        Returns: Json
      }
      fn_record_expense_atomic: {
        Args: {
          p_account_id: string
          p_amount: number
          p_category: string
          p_expense_date: string
          p_notes?: string
          p_tags?: string[]
          p_title: string
          p_user_id: string
        }
        Returns: Json
      }
      fn_record_income_atomic: {
        Args: {
          p_account_id: string
          p_amount: number
          p_category: string
          p_frequency: string
          p_notes?: string
          p_received_date: string
          p_tags?: string[]
          p_title: string
          p_user_id: string
        }
        Returns: Json
      }
      fn_record_transfer_atomic: {
        Args: {
          p_amount: number
          p_from_account_id: string
          p_notes?: string
          p_to_account_id: string
          p_transfer_date: string
          p_user_id: string
        }
        Returns: Json
      }
      fn_update_expense_atomic: {
        Args: {
          p_account_id: string
          p_amount: number
          p_category: string
          p_expense_date: string
          p_expense_id: string
          p_notes?: string
          p_tags?: string[]
          p_title: string
          p_user_id: string
        }
        Returns: Json
      }
      fn_wipe_user_data: { Args: { p_user_id: string }; Returns: Json }
      increment_account_balance: {
        Args: { p_account_id: string; p_amount: number; p_user_id: string }
        Returns: number
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
