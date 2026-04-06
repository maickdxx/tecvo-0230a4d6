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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ab_test_assignments: {
        Row: {
          anonymous_id: string | null
          created_at: string | null
          id: string
          test_id: string | null
          user_id: string | null
          variant_id: string | null
        }
        Insert: {
          anonymous_id?: string | null
          created_at?: string | null
          id?: string
          test_id?: string | null
          user_id?: string | null
          variant_id?: string | null
        }
        Update: {
          anonymous_id?: string | null
          created_at?: string | null
          id?: string
          test_id?: string | null
          user_id?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ab_test_assignments_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "ab_tests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ab_test_assignments_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "view_analytics_ab_test_results"
            referencedColumns: ["test_id"]
          },
          {
            foreignKeyName: "ab_test_assignments_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "ab_test_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ab_test_assignments_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "view_analytics_ab_test_results"
            referencedColumns: ["variant_id"]
          },
        ]
      }
      ab_test_hypotheses: {
        Row: {
          created_at: string
          expected_impact: string
          hypothesis_improvement: string
          id: string
          learnings: string | null
          priority_score: number | null
          problem_identified: string
          proposed_solution: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expected_impact?: string
          hypothesis_improvement: string
          id?: string
          learnings?: string | null
          priority_score?: number | null
          problem_identified: string
          proposed_solution: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expected_impact?: string
          hypothesis_improvement?: string
          id?: string
          learnings?: string | null
          priority_score?: number | null
          problem_identified?: string
          proposed_solution?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      ab_test_pattern_applications: {
        Row: {
          applied_at: string | null
          id: string
          is_active: boolean | null
          pattern_id: string | null
          performance_metric: Json | null
          target_element: string
          target_page: string
        }
        Insert: {
          applied_at?: string | null
          id?: string
          is_active?: boolean | null
          pattern_id?: string | null
          performance_metric?: Json | null
          target_element: string
          target_page: string
        }
        Update: {
          applied_at?: string | null
          id?: string
          is_active?: boolean | null
          pattern_id?: string | null
          performance_metric?: Json | null
          target_element?: string
          target_page?: string
        }
        Relationships: [
          {
            foreignKeyName: "ab_test_pattern_applications_pattern_id_fkey"
            columns: ["pattern_id"]
            isOneToOne: false
            referencedRelation: "ab_test_winning_patterns"
            referencedColumns: ["id"]
          },
        ]
      }
      ab_test_templates: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          structure: Json
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          structure: Json
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          structure?: Json
          updated_at?: string
        }
        Relationships: []
      }
      ab_test_variants: {
        Row: {
          config: Json | null
          created_at: string | null
          id: string
          is_control: boolean | null
          name: string
          test_id: string | null
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          id?: string
          is_control?: boolean | null
          name: string
          test_id?: string | null
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          id?: string
          is_control?: boolean | null
          name?: string
          test_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ab_test_variants_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "ab_tests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ab_test_variants_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "view_analytics_ab_test_results"
            referencedColumns: ["test_id"]
          },
        ]
      }
      ab_test_winning_patterns: {
        Row: {
          category: string | null
          content: Json
          conversion_rate: number | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          is_validated: boolean | null
          name: string
          pattern_type: string
          performance_lift: number | null
          source_test_id: string | null
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          content: Json
          conversion_rate?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_validated?: boolean | null
          name: string
          pattern_type: string
          performance_lift?: number | null
          source_test_id?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          content?: Json
          conversion_rate?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_validated?: boolean | null
          name?: string
          pattern_type?: string
          performance_lift?: number | null
          source_test_id?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ab_test_winning_patterns_source_test_id_fkey"
            columns: ["source_test_id"]
            isOneToOne: false
            referencedRelation: "ab_tests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ab_test_winning_patterns_source_test_id_fkey"
            columns: ["source_test_id"]
            isOneToOne: false
            referencedRelation: "view_analytics_ab_test_results"
            referencedColumns: ["test_id"]
          },
        ]
      }
      ab_tests: {
        Row: {
          created_at: string | null
          description: string | null
          end_date: string | null
          hypothesis_id: string | null
          id: string
          is_active: boolean | null
          name: string
          start_date: string | null
          traffic_percentage: number | null
          updated_at: string | null
          winner_variant_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          hypothesis_id?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          start_date?: string | null
          traffic_percentage?: number | null
          updated_at?: string | null
          winner_variant_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          hypothesis_id?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          start_date?: string | null
          traffic_percentage?: number | null
          updated_at?: string | null
          winner_variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ab_tests_hypothesis_id_fkey"
            columns: ["hypothesis_id"]
            isOneToOne: false
            referencedRelation: "ab_test_hypotheses"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_assistant_permissions: {
        Row: {
          allowed_actions: string[] | null
          created_at: string | null
          id: string
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          allowed_actions?: string[] | null
          created_at?: string | null
          id?: string
          organization_id: string
          updated_at?: string | null
        }
        Update: {
          allowed_actions?: string[] | null
          created_at?: string | null
          id?: string
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_assistant_permissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_credit_config: {
        Row: {
          action_slug: string
          created_at: string
          credits_cost: number
          id: string
          label: string
          updated_at: string
        }
        Insert: {
          action_slug: string
          created_at?: string
          credits_cost: number
          id?: string
          label: string
          updated_at?: string
        }
        Update: {
          action_slug?: string
          created_at?: string
          credits_cost?: number
          id?: string
          label?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_credit_transactions: {
        Row: {
          action_type: string
          amount: number
          created_at: string
          description: string | null
          id: string
          organization_id: string
          user_id: string | null
        }
        Insert: {
          action_type: string
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          organization_id: string
          user_id?: string | null
        }
        Update: {
          action_type?: string
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          organization_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_credit_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_credits: {
        Row: {
          balance: number
          created_at: string
          id: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_credits_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_response_audit: {
        Row: {
          ai_response: string
          channel: string
          classification: string
          context_snapshot: Json | null
          created_at: string
          data_source: string | null
          had_limit: boolean | null
          had_truncation: boolean | null
          id: string
          is_total_or_partial: string | null
          numbers_cited: Json | null
          organization_id: string
          period_considered: string | null
          user_id: string | null
          user_question: string
        }
        Insert: {
          ai_response: string
          channel?: string
          classification?: string
          context_snapshot?: Json | null
          created_at?: string
          data_source?: string | null
          had_limit?: boolean | null
          had_truncation?: boolean | null
          id?: string
          is_total_or_partial?: string | null
          numbers_cited?: Json | null
          organization_id: string
          period_considered?: string | null
          user_id?: string | null
          user_question: string
        }
        Update: {
          ai_response?: string
          channel?: string
          classification?: string
          context_snapshot?: Json | null
          created_at?: string
          data_source?: string | null
          had_limit?: boolean | null
          had_truncation?: boolean | null
          id?: string
          is_total_or_partial?: string | null
          numbers_cited?: Json | null
          organization_id?: string
          period_considered?: string | null
          user_id?: string | null
          user_question?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_response_audit_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_logs: {
        Row: {
          action_slug: string
          completion_tokens: number | null
          created_at: string
          duration_ms: number | null
          estimated_cost_usd: number | null
          id: string
          model: string | null
          organization_id: string | null
          prompt_tokens: number | null
          status: string
          total_tokens: number | null
          user_id: string | null
        }
        Insert: {
          action_slug: string
          completion_tokens?: number | null
          created_at?: string
          duration_ms?: number | null
          estimated_cost_usd?: number | null
          id?: string
          model?: string | null
          organization_id?: string | null
          prompt_tokens?: number | null
          status?: string
          total_tokens?: number | null
          user_id?: string | null
        }
        Update: {
          action_slug?: string
          completion_tokens?: number | null
          created_at?: string
          duration_ms?: number | null
          estimated_cost_usd?: number | null
          id?: string
          model?: string | null
          organization_id?: string | null
          prompt_tokens?: number | null
          status?: string
          total_tokens?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_alerts: {
        Row: {
          alert_type: string
          created_at: string | null
          id: string
          message: string
          metadata: Json | null
          organization_id: string | null
          resolved_at: string | null
          severity: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          alert_type: string
          created_at?: string | null
          id?: string
          message: string
          metadata?: Json | null
          organization_id?: string | null
          resolved_at?: string | null
          severity?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          alert_type?: string
          created_at?: string | null
          id?: string
          message?: string
          metadata?: Json | null
          organization_id?: string | null
          resolved_at?: string | null
          severity?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_alerts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "view_analytics_user_scores"
            referencedColumns: ["user_id"]
          },
        ]
      }
      analytics_automation_logs: {
        Row: {
          automation_id: string | null
          channel: string | null
          email: string | null
          error_message: string | null
          id: string
          metadata: Json | null
          organization_id: string | null
          sent_at: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          automation_id?: string | null
          channel?: string | null
          email?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string | null
          sent_at?: string | null
          status: string
          user_id?: string | null
        }
        Update: {
          automation_id?: string | null
          channel?: string | null
          email?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string | null
          sent_at?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_automation_logs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "analytics_automations"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_automations: {
        Row: {
          cooldown_hours: number | null
          created_at: string | null
          delay_minutes: number | null
          description: string | null
          email_template: string | null
          enabled: boolean | null
          id: string
          message_template: string
          name: string
          trigger_type: string
          updated_at: string | null
        }
        Insert: {
          cooldown_hours?: number | null
          created_at?: string | null
          delay_minutes?: number | null
          description?: string | null
          email_template?: string | null
          enabled?: boolean | null
          id?: string
          message_template: string
          name: string
          trigger_type: string
          updated_at?: string | null
        }
        Update: {
          cooldown_hours?: number | null
          created_at?: string | null
          delay_minutes?: number | null
          description?: string | null
          email_template?: string | null
          enabled?: boolean | null
          id?: string
          message_template?: string
          name?: string
          trigger_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      analytics_internal_ids: {
        Row: {
          anonymous_id: string
          created_at: string | null
          id: string
          reason: string | null
        }
        Insert: {
          anonymous_id: string
          created_at?: string | null
          id?: string
          reason?: string | null
        }
        Update: {
          anonymous_id?: string
          created_at?: string | null
          id?: string
          reason?: string | null
        }
        Relationships: []
      }
      announcements: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          organization_id: string
          priority: string
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          organization_id: string
          priority?: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          organization_id?: string
          priority?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_conversations: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      assistant_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          tool_calls: Json | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          tool_calls?: Json | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          tool_calls?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "assistant_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "assistant_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_message_log: {
        Row: {
          content: string | null
          id: string
          message_type: string
          organization_id: string
          send_status: string
          sent_at: string | null
          sent_date: string | null
        }
        Insert: {
          content?: string | null
          id?: string
          message_type: string
          organization_id: string
          send_status?: string
          sent_at?: string | null
          sent_date?: string | null
        }
        Update: {
          content?: string | null
          id?: string
          message_type?: string
          organization_id?: string
          send_status?: string
          sent_at?: string | null
          sent_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auto_message_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      backup_logs: {
        Row: {
          backup_path: string
          completed_at: string | null
          error_message: string | null
          id: string
          organization_id: string
          record_counts: Json
          size_bytes: number | null
          started_at: string
          status: string
          tables_included: string[]
        }
        Insert: {
          backup_path: string
          completed_at?: string | null
          error_message?: string | null
          id?: string
          organization_id: string
          record_counts?: Json
          size_bytes?: number | null
          started_at?: string
          status?: string
          tables_included?: string[]
        }
        Update: {
          backup_path?: string
          completed_at?: string | null
          error_message?: string | null
          id?: string
          organization_id?: string
          record_counts?: Json
          size_bytes?: number | null
          started_at?: string
          status?: string
          tables_included?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "backup_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_email_log: {
        Row: {
          created_at: string
          email_type: string
          error_message: string | null
          id: string
          metadata: Json | null
          organization_id: string
          plan: string | null
          recipient_email: string
          status: string
        }
        Insert: {
          created_at?: string
          email_type: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          organization_id: string
          plan?: string | null
          recipient_email: string
          status?: string
        }
        Update: {
          created_at?: string
          email_type?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string
          plan?: string | null
          recipient_email?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_email_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_events: {
        Row: {
          amount_cents: number | null
          created_at: string
          currency: string | null
          event_type: string
          id: string
          metadata: Json | null
          organization_id: string
          plan: string | null
          previous_plan: string | null
          status: string | null
          stripe_event_id: string | null
          stripe_invoice_id: string | null
          stripe_subscription_id: string | null
        }
        Insert: {
          amount_cents?: number | null
          created_at?: string
          currency?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          organization_id: string
          plan?: string | null
          previous_plan?: string | null
          status?: string | null
          stripe_event_id?: string | null
          stripe_invoice_id?: string | null
          stripe_subscription_id?: string | null
        }
        Update: {
          amount_cents?: number | null
          created_at?: string
          currency?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          organization_id?: string
          plan?: string | null
          previous_plan?: string | null
          status?: string | null
          stripe_event_id?: string | null
          stripe_invoice_id?: string | null
          stripe_subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_config: {
        Row: {
          cooldown_hours: number
          current_campaign: string | null
          current_campaign_started_at: string | null
          id: number
          is_paused: boolean
          max_interval_seconds: number
          min_interval_seconds: number
          paused_reason: string | null
          sends_per_hour: number
          updated_at: string
        }
        Insert: {
          cooldown_hours?: number
          current_campaign?: string | null
          current_campaign_started_at?: string | null
          id?: number
          is_paused?: boolean
          max_interval_seconds?: number
          min_interval_seconds?: number
          paused_reason?: string | null
          sends_per_hour?: number
          updated_at?: string
        }
        Update: {
          cooldown_hours?: number
          current_campaign?: string | null
          current_campaign_started_at?: string | null
          id?: number
          is_paused?: boolean
          max_interval_seconds?: number
          min_interval_seconds?: number
          paused_reason?: string | null
          sends_per_hour?: number
          updated_at?: string
        }
        Relationships: []
      }
      campaign_sends: {
        Row: {
          campaign_name: string
          channel_decided_at: string | null
          created_at: string
          email: string | null
          email_error: string | null
          email_sent_at: string | null
          email_status: string | null
          email_subject: string | null
          email_template: string | null
          id: string
          message_template: string
          organization_id: string | null
          phone: string | null
          primary_channel: string | null
          priority: number
          processed_at: string | null
          status: string
          updated_at: string
          user_id: string
          user_name: string | null
          whatsapp_error: string | null
          whatsapp_sent_at: string | null
          whatsapp_status: string | null
        }
        Insert: {
          campaign_name?: string
          channel_decided_at?: string | null
          created_at?: string
          email?: string | null
          email_error?: string | null
          email_sent_at?: string | null
          email_status?: string | null
          email_subject?: string | null
          email_template?: string | null
          id?: string
          message_template: string
          organization_id?: string | null
          phone?: string | null
          primary_channel?: string | null
          priority?: number
          processed_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
          user_name?: string | null
          whatsapp_error?: string | null
          whatsapp_sent_at?: string | null
          whatsapp_status?: string | null
        }
        Update: {
          campaign_name?: string
          channel_decided_at?: string | null
          created_at?: string
          email?: string | null
          email_error?: string | null
          email_sent_at?: string | null
          email_status?: string | null
          email_subject?: string | null
          email_template?: string | null
          id?: string
          message_template?: string
          organization_id?: string | null
          phone?: string | null
          primary_channel?: string | null
          priority?: number
          processed_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          user_name?: string | null
          whatsapp_error?: string | null
          whatsapp_sent_at?: string | null
          whatsapp_status?: string | null
        }
        Relationships: []
      }
      catalog_services: {
        Row: {
          category: string | null
          checklist_id: string | null
          created_at: string | null
          default_discount: number | null
          deleted_at: string | null
          description: string | null
          estimated_duration: string | null
          id: string
          is_active: boolean | null
          is_non_standard: boolean | null
          name: string
          notes: string | null
          organization_id: string
          service_type: string
          standard_checklist: Json | null
          unit_price: number
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          checklist_id?: string | null
          created_at?: string | null
          default_discount?: number | null
          deleted_at?: string | null
          description?: string | null
          estimated_duration?: string | null
          id?: string
          is_active?: boolean | null
          is_non_standard?: boolean | null
          name: string
          notes?: string | null
          organization_id: string
          service_type?: string
          standard_checklist?: Json | null
          unit_price?: number
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          checklist_id?: string | null
          created_at?: string | null
          default_discount?: number | null
          deleted_at?: string | null
          description?: string | null
          estimated_duration?: string | null
          id?: string
          is_active?: boolean | null
          is_non_standard?: boolean | null
          name?: string
          notes?: string | null
          organization_id?: string
          service_type?: string
          standard_checklist?: Json | null
          unit_price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catalog_services_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "pmoc_checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_services_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_portal_config: {
        Row: {
          contact_phone: string | null
          created_at: string
          custom_domain: string | null
          display_name: string | null
          domain_status: string
          id: string
          is_active: boolean
          logo_url: string | null
          organization_id: string
          primary_color: string | null
          secondary_color: string | null
          slug: string | null
          updated_at: string
          welcome_message: string | null
        }
        Insert: {
          contact_phone?: string | null
          created_at?: string
          custom_domain?: string | null
          display_name?: string | null
          domain_status?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          organization_id: string
          primary_color?: string | null
          secondary_color?: string | null
          slug?: string | null
          updated_at?: string
          welcome_message?: string | null
        }
        Update: {
          contact_phone?: string | null
          created_at?: string
          custom_domain?: string | null
          display_name?: string | null
          domain_status?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          organization_id?: string
          primary_color?: string | null
          secondary_color?: string | null
          slug?: string | null
          updated_at?: string
          welcome_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_portal_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_portal_sessions: {
        Row: {
          client_id: string | null
          created_at: string | null
          id: string
          is_verified: boolean | null
          organization_id: string | null
          otp_attempts: number | null
          otp_code: string | null
          otp_expires_at: string | null
          phone: string
          session_token: string | null
          token_expires_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          id?: string
          is_verified?: boolean | null
          organization_id?: string | null
          otp_attempts?: number | null
          otp_code?: string | null
          otp_expires_at?: string | null
          phone: string
          session_token?: string | null
          token_expires_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          id?: string
          is_verified?: boolean | null
          organization_id?: string | null
          otp_attempts?: number | null
          otp_code?: string | null
          otp_expires_at?: string | null
          phone?: string
          session_token?: string | null
          token_expires_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_portal_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_portal_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          city: string | null
          client_origin: string | null
          client_status: string | null
          client_type: string | null
          company_name: string | null
          complement: string | null
          contact_name: string | null
          created_at: string
          deleted_at: string | null
          document: string | null
          email: string | null
          id: string
          internal_notes: string | null
          is_demo_data: boolean
          maintenance_reminder_enabled: boolean
          name: string
          neighborhood: string | null
          notes: string | null
          number: string | null
          organization_id: string
          person_type: string
          phone: string
          state: string | null
          state_registration: string | null
          street: string | null
          trade_name: string | null
          updated_at: string
          whatsapp: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          client_origin?: string | null
          client_status?: string | null
          client_type?: string | null
          company_name?: string | null
          complement?: string | null
          contact_name?: string | null
          created_at?: string
          deleted_at?: string | null
          document?: string | null
          email?: string | null
          id?: string
          internal_notes?: string | null
          is_demo_data?: boolean
          maintenance_reminder_enabled?: boolean
          name: string
          neighborhood?: string | null
          notes?: string | null
          number?: string | null
          organization_id: string
          person_type?: string
          phone: string
          state?: string | null
          state_registration?: string | null
          street?: string | null
          trade_name?: string | null
          updated_at?: string
          whatsapp?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          client_origin?: string | null
          client_status?: string | null
          client_type?: string | null
          company_name?: string | null
          complement?: string | null
          contact_name?: string | null
          created_at?: string
          deleted_at?: string | null
          document?: string | null
          email?: string | null
          id?: string
          internal_notes?: string | null
          is_demo_data?: boolean
          maintenance_reminder_enabled?: boolean
          name?: string
          neighborhood?: string | null
          notes?: string | null
          number?: string | null
          organization_id?: string
          person_type?: string
          phone?: string
          state?: string | null
          state_registration?: string | null
          street?: string | null
          trade_name?: string | null
          updated_at?: string
          whatsapp?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_redemptions: {
        Row: {
          applied_ai_credits: number | null
          applied_discount_percent: number | null
          coupon_id: string
          created_at: string
          id: string
          organization_id: string
          user_id: string
        }
        Insert: {
          applied_ai_credits?: number | null
          applied_discount_percent?: number | null
          coupon_id: string
          created_at?: string
          id?: string
          organization_id: string
          user_id: string
        }
        Update: {
          applied_ai_credits?: number | null
          applied_discount_percent?: number | null
          coupon_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          ai_credits_amount: number | null
          applicable_plans: string[] | null
          code: string
          coupon_type: string
          created_at: string
          description: string | null
          discount_percent: number | null
          id: string
          is_active: boolean
          max_uses: number | null
          stripe_coupon_id: string | null
          times_used: number
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          ai_credits_amount?: number | null
          applicable_plans?: string[] | null
          code: string
          coupon_type?: string
          created_at?: string
          description?: string | null
          discount_percent?: number | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          stripe_coupon_id?: string | null
          times_used?: number
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          ai_credits_amount?: number | null
          applicable_plans?: string[] | null
          code?: string
          coupon_type?: string
          created_at?: string
          description?: string | null
          discount_percent?: number | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          stripe_coupon_id?: string | null
          times_used?: number
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      data_audit_log: {
        Row: {
          created_at: string
          id: string
          ip_address: string | null
          metadata: Json | null
          new_data: Json | null
          old_data: Json | null
          operation: string
          organization_id: string | null
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          new_data?: Json | null
          old_data?: Json | null
          operation: string
          organization_id?: string | null
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          new_data?: Json | null
          old_data?: Json | null
          operation?: string
          organization_id?: string | null
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "data_audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      email_verifications: {
        Row: {
          code: string
          created_at: string
          email: string
          expires_at: string
          id: string
          verified: boolean
        }
        Insert: {
          code: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          verified?: boolean
        }
        Update: {
          code?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          verified?: boolean
        }
        Relationships: []
      }
      employee_expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          date: string
          description: string
          employee_id: string
          id: string
          notes: string | null
          organization_id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          service_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          date?: string
          description: string
          employee_id: string
          id?: string
          notes?: string | null
          organization_id: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          date?: string
          description?: string
          employee_id?: string
          id?: string
          notes?: string | null
          organization_id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_expenses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_expenses_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_report_data: {
        Row: {
          checklist: Json | null
          created_at: string
          equipment_id: string
          id: string
          observations: string | null
          organization_id: string
          problem_identified: string | null
          report_id: string | null
          service_id: string
          service_type_performed: string | null
          status: string
          updated_at: string
          work_performed: string | null
        }
        Insert: {
          checklist?: Json | null
          created_at?: string
          equipment_id: string
          id?: string
          observations?: string | null
          organization_id: string
          problem_identified?: string | null
          report_id?: string | null
          service_id: string
          service_type_performed?: string | null
          status?: string
          updated_at?: string
          work_performed?: string | null
        }
        Update: {
          checklist?: Json | null
          created_at?: string
          equipment_id?: string
          id?: string
          observations?: string | null
          organization_id?: string
          problem_identified?: string | null
          report_id?: string | null
          service_id?: string
          service_type_performed?: string | null
          status?: string
          updated_at?: string
          work_performed?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_report_data_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "service_equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_report_data_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_report_data_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "technical_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_report_data_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      external_backup_logs: {
        Row: {
          backup_date: string
          completed_at: string | null
          destination: string
          error_message: string | null
          id: string
          metadata: Json | null
          organization_id: string | null
          s3_key: string
          size_bytes: number | null
          started_at: string
          status: string
        }
        Insert: {
          backup_date: string
          completed_at?: string | null
          destination?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string | null
          s3_key: string
          size_bytes?: number | null
          started_at?: string
          status?: string
        }
        Update: {
          backup_date?: string
          completed_at?: string | null
          destination?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string | null
          s3_key?: string
          size_bytes?: number | null
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_backup_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          created_at: string
          description: string
          id: string
          organization_id: string
          status: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          organization_id: string
          status?: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          organization_id?: string
          status?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_accounts: {
        Row: {
          account_type: string
          balance: number
          created_at: string
          id: string
          is_active: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          account_type?: string
          balance?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          account_type?: string
          balance?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string | null
          id: string
          invited_by: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string | null
          id?: string
          invited_by: string
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string | null
          id?: string
          invited_by?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_followups: {
        Row: {
          channel_id: string
          completed_at: string | null
          created_at: string
          first_contact_at: string
          id: string
          last_followup_sent_at: string | null
          next_followup_at: string | null
          organization_id: string
          phone: string
          status: string
          step: number
          updated_at: string
        }
        Insert: {
          channel_id: string
          completed_at?: string | null
          created_at?: string
          first_contact_at?: string
          id?: string
          last_followup_sent_at?: string | null
          next_followup_at?: string | null
          organization_id: string
          phone: string
          status?: string
          step?: number
          updated_at?: string
        }
        Update: {
          channel_id?: string
          completed_at?: string | null
          created_at?: string
          first_contact_at?: string
          id?: string
          last_followup_sent_at?: string | null
          next_followup_at?: string | null
          organization_id?: string
          phone?: string
          status?: string
          step?: number
          updated_at?: string
        }
        Relationships: []
      }
      member_permissions: {
        Row: {
          created_at: string | null
          id: string
          module: string
          organization_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          module: string
          organization_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          module?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_permissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      message_send_queue: {
        Row: {
          attempts: number
          created_at: string
          id: string
          idempotency_key: string | null
          instance_name: string | null
          last_error: string | null
          max_attempts: number
          message_content: string
          message_type: string
          organization_id: string
          phone: string
          priority: string
          scheduled_for: string
          sent_at: string | null
          source_function: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          idempotency_key?: string | null
          instance_name?: string | null
          last_error?: string | null
          max_attempts?: number
          message_content: string
          message_type?: string
          organization_id: string
          phone: string
          priority?: string
          scheduled_for: string
          sent_at?: string | null
          source_function?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          idempotency_key?: string | null
          instance_name?: string | null
          last_error?: string | null
          max_attempts?: number
          message_content?: string
          message_type?: string
          organization_id?: string
          phone?: string
          priority?: string
          scheduled_for?: string
          sent_at?: string | null
          source_function?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_send_queue_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_tokens: {
        Row: {
          auth: string
          created_at: string
          device_info: string | null
          endpoint: string
          id: string
          organization_id: string
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          device_info?: string | null
          endpoint: string
          id?: string
          organization_id: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          device_info?: string | null
          endpoint?: string
          id?: string
          organization_id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      onboarding_delivery_logs: {
        Row: {
          channel: string
          created_at: string
          error_message: string | null
          id: string
          organization_id: string
          payload_snapshot: Json | null
          provider_message_id: string | null
          sent_at: string | null
          status: string
          trigger_type: string
          user_id: string
        }
        Insert: {
          channel: string
          created_at?: string
          error_message?: string | null
          id?: string
          organization_id: string
          payload_snapshot?: Json | null
          provider_message_id?: string | null
          sent_at?: string | null
          status?: string
          trigger_type: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          error_message?: string | null
          id?: string
          organization_id?: string
          payload_snapshot?: Json | null
          provider_message_id?: string | null
          sent_at?: string | null
          status?: string
          trigger_type?: string
          user_id?: string
        }
        Relationships: []
      }
      operational_capacity_config: {
        Row: {
          active_teams: number
          break_minutes: number | null
          created_at: string
          default_travel_minutes: number
          end_time: string | null
          id: string
          organization_id: string
          saturday_minutes: number | null
          schedule_mode: string
          start_time: string | null
          total_minutes_per_day: number
          updated_at: string
          works_saturday: boolean
        }
        Insert: {
          active_teams?: number
          break_minutes?: number | null
          created_at?: string
          default_travel_minutes?: number
          end_time?: string | null
          id?: string
          organization_id: string
          saturday_minutes?: number | null
          schedule_mode?: string
          start_time?: string | null
          total_minutes_per_day?: number
          updated_at?: string
          works_saturday?: boolean
        }
        Update: {
          active_teams?: number
          break_minutes?: number | null
          created_at?: string
          default_travel_minutes?: number
          end_time?: string | null
          id?: string
          organization_id?: string
          saturday_minutes?: number | null
          schedule_mode?: string
          start_time?: string | null
          total_minutes_per_day?: number
          updated_at?: string
          works_saturday?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "operational_capacity_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_usage: {
        Row: {
          created_at: string | null
          id: string
          month_year: string
          organization_id: string
          services_created: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          month_year: string
          organization_id: string
          services_created?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          month_year?: string
          organization_id?: string
          services_created?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_usage_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          activation_step: string
          address: string | null
          auto_notify_client_completion: boolean
          auto_signature_os: boolean | null
          cancel_at_period_end: boolean
          city: string | null
          cnpj_cpf: string | null
          created_at: string
          default_ai_account_id: string | null
          email: string | null
          guided_onboarding_dismissed: boolean
          id: string
          is_demo_mode: boolean
          logo_url: string | null
          messaging_paused: boolean
          messaging_paused_at: string | null
          messaging_paused_reason: string | null
          monthly_goal: number | null
          name: string
          onboarding_completed: boolean | null
          page_tutorials_seen: Json
          past_due_since: string | null
          phone: string | null
          plan: string | null
          plan_expires_at: string | null
          primary_color: string
          require_client_signature: boolean | null
          signature_url: string | null
          state: string | null
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          theme_mode: string
          time_clock_enabled: boolean
          timezone: string
          trial_ends_at: string | null
          trial_started_at: string | null
          website: string | null
          welcome_shown: boolean
          welcome_whatsapp_sent: boolean
          whatsapp_owner: string | null
          zip_code: string | null
        }
        Insert: {
          activation_step?: string
          address?: string | null
          auto_notify_client_completion?: boolean
          auto_signature_os?: boolean | null
          cancel_at_period_end?: boolean
          city?: string | null
          cnpj_cpf?: string | null
          created_at?: string
          default_ai_account_id?: string | null
          email?: string | null
          guided_onboarding_dismissed?: boolean
          id?: string
          is_demo_mode?: boolean
          logo_url?: string | null
          messaging_paused?: boolean
          messaging_paused_at?: string | null
          messaging_paused_reason?: string | null
          monthly_goal?: number | null
          name: string
          onboarding_completed?: boolean | null
          page_tutorials_seen?: Json
          past_due_since?: string | null
          phone?: string | null
          plan?: string | null
          plan_expires_at?: string | null
          primary_color?: string
          require_client_signature?: boolean | null
          signature_url?: string | null
          state?: string | null
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          theme_mode?: string
          time_clock_enabled?: boolean
          timezone?: string
          trial_ends_at?: string | null
          trial_started_at?: string | null
          website?: string | null
          welcome_shown?: boolean
          welcome_whatsapp_sent?: boolean
          whatsapp_owner?: string | null
          zip_code?: string | null
        }
        Update: {
          activation_step?: string
          address?: string | null
          auto_notify_client_completion?: boolean
          auto_signature_os?: boolean | null
          cancel_at_period_end?: boolean
          city?: string | null
          cnpj_cpf?: string | null
          created_at?: string
          default_ai_account_id?: string | null
          email?: string | null
          guided_onboarding_dismissed?: boolean
          id?: string
          is_demo_mode?: boolean
          logo_url?: string | null
          messaging_paused?: boolean
          messaging_paused_at?: string | null
          messaging_paused_reason?: string | null
          monthly_goal?: number | null
          name?: string
          onboarding_completed?: boolean | null
          page_tutorials_seen?: Json
          past_due_since?: string | null
          phone?: string | null
          plan?: string | null
          plan_expires_at?: string | null
          primary_color?: string
          require_client_signature?: boolean | null
          signature_url?: string | null
          state?: string | null
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          theme_mode?: string
          time_clock_enabled?: boolean
          timezone?: string
          trial_ends_at?: string | null
          trial_started_at?: string | null
          website?: string | null
          welcome_shown?: boolean
          welcome_whatsapp_sent?: boolean
          whatsapp_owner?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_default_ai_account_id_fkey"
            columns: ["default_ai_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      password_reset_codes: {
        Row: {
          attempts: number
          blocked_until: string | null
          code: string
          created_at: string
          email: string
          expires_at: string
          id: string
          verified: boolean
        }
        Insert: {
          attempts?: number
          blocked_until?: string | null
          code: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          verified?: boolean
        }
        Update: {
          attempts?: number
          blocked_until?: string | null
          code?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          verified?: boolean
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          created_at: string | null
          default_financial_account_id: string | null
          fee_type: string
          fee_value: number
          id: string
          installments: number | null
          is_active: boolean
          is_default: boolean
          name: string
          organization_id: string
          slug: string
        }
        Insert: {
          created_at?: string | null
          default_financial_account_id?: string | null
          fee_type?: string
          fee_value?: number
          id?: string
          installments?: number | null
          is_active?: boolean
          is_default?: boolean
          name: string
          organization_id: string
          slug: string
        }
        Update: {
          created_at?: string | null
          default_financial_account_id?: string | null
          fee_type?: string
          fee_value?: number
          id?: string
          installments?: number | null
          is_active?: boolean
          is_default?: boolean
          name?: string
          organization_id?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_default_financial_account_id_fkey"
            columns: ["default_financial_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_methods_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admin_notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          metadata: Json | null
          notification_type: string
          organization_id: string | null
          sent_at: string | null
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          notification_type: string
          organization_id?: string | null
          sent_at?: string | null
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          notification_type?: string
          organization_id?: string | null
          sent_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_admin_notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pmoc_checklists: {
        Row: {
          coil_cleaning: boolean | null
          completed_at: string | null
          completed_by: string | null
          contract_id: string
          created_at: string
          drain_check: boolean | null
          electrical_check: boolean | null
          equipment_id: string
          filter_cleaning: boolean | null
          gas_pressure: boolean | null
          id: string
          organization_id: string
          service_id: string | null
          technician_notes: string | null
          temperature: string | null
        }
        Insert: {
          coil_cleaning?: boolean | null
          completed_at?: string | null
          completed_by?: string | null
          contract_id: string
          created_at?: string
          drain_check?: boolean | null
          electrical_check?: boolean | null
          equipment_id: string
          filter_cleaning?: boolean | null
          gas_pressure?: boolean | null
          id?: string
          organization_id: string
          service_id?: string | null
          technician_notes?: string | null
          temperature?: string | null
        }
        Update: {
          coil_cleaning?: boolean | null
          completed_at?: string | null
          completed_by?: string | null
          contract_id?: string
          created_at?: string
          drain_check?: boolean | null
          electrical_check?: boolean | null
          equipment_id?: string
          filter_cleaning?: boolean | null
          gas_pressure?: boolean | null
          id?: string
          organization_id?: string
          service_id?: string | null
          technician_notes?: string | null
          temperature?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pmoc_checklists_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "pmoc_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pmoc_checklists_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "pmoc_equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pmoc_checklists_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pmoc_checklists_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      pmoc_contracts: {
        Row: {
          assigned_to: string | null
          client_id: string
          created_at: string
          deleted_at: string | null
          id: string
          monthly_value: number | null
          name: string
          next_service_date: string | null
          notes: string | null
          organization_id: string
          periodicity: string
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          client_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          monthly_value?: number | null
          name: string
          next_service_date?: string | null
          notes?: string | null
          organization_id: string
          periodicity?: string
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          client_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          monthly_value?: number | null
          name?: string
          next_service_date?: string | null
          notes?: string | null
          organization_id?: string
          periodicity?: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pmoc_contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pmoc_contracts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pmoc_equipment: {
        Row: {
          brand: string | null
          btus: string | null
          contract_id: string
          created_at: string
          equipment_type: string
          id: string
          location: string | null
          model: string | null
          organization_id: string
          serial_number: string | null
        }
        Insert: {
          brand?: string | null
          btus?: string | null
          contract_id: string
          created_at?: string
          equipment_type: string
          id?: string
          location?: string | null
          model?: string | null
          organization_id: string
          serial_number?: string | null
        }
        Update: {
          brand?: string | null
          btus?: string | null
          contract_id?: string
          created_at?: string
          equipment_type?: string
          id?: string
          location?: string | null
          model?: string | null
          organization_id?: string
          serial_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pmoc_equipment_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "pmoc_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pmoc_equipment_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address_cep: string | null
          address_city: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          ai_assistant_name: string | null
          ai_assistant_voice: string | null
          avatar_url: string | null
          birth_date: string | null
          color_theme: string | null
          cpf: string | null
          created_at: string
          daily_routine: Json | null
          dashboard_action_history: Json | null
          dashboard_layout: Json | null
          demo_tour_completed: boolean
          employee_type: string
          field_worker: boolean
          first_landing_page: string | null
          first_referrer: string | null
          first_utm_campaign: string | null
          first_utm_medium: string | null
          first_utm_source: string | null
          full_name: string | null
          hire_date: string | null
          hourly_rate: number | null
          id: string
          last_access: string | null
          notes: string | null
          notification_preferences: Json | null
          onboarding_completed: boolean | null
          organization_id: string
          phone: string | null
          position: string | null
          rg: string | null
          theme_mode: string | null
          updated_at: string
          user_id: string
          whatsapp_ai_enabled: boolean
          whatsapp_personal: string | null
          whatsapp_signature: string | null
          whatsapp_signature_enabled: boolean
        }
        Insert: {
          address_cep?: string | null
          address_city?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          ai_assistant_name?: string | null
          ai_assistant_voice?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          color_theme?: string | null
          cpf?: string | null
          created_at?: string
          daily_routine?: Json | null
          dashboard_action_history?: Json | null
          dashboard_layout?: Json | null
          demo_tour_completed?: boolean
          employee_type?: string
          field_worker?: boolean
          first_landing_page?: string | null
          first_referrer?: string | null
          first_utm_campaign?: string | null
          first_utm_medium?: string | null
          first_utm_source?: string | null
          full_name?: string | null
          hire_date?: string | null
          hourly_rate?: number | null
          id?: string
          last_access?: string | null
          notes?: string | null
          notification_preferences?: Json | null
          onboarding_completed?: boolean | null
          organization_id: string
          phone?: string | null
          position?: string | null
          rg?: string | null
          theme_mode?: string | null
          updated_at?: string
          user_id: string
          whatsapp_ai_enabled?: boolean
          whatsapp_personal?: string | null
          whatsapp_signature?: string | null
          whatsapp_signature_enabled?: boolean
        }
        Update: {
          address_cep?: string | null
          address_city?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          ai_assistant_name?: string | null
          ai_assistant_voice?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          color_theme?: string | null
          cpf?: string | null
          created_at?: string
          daily_routine?: Json | null
          dashboard_action_history?: Json | null
          dashboard_layout?: Json | null
          demo_tour_completed?: boolean
          employee_type?: string
          field_worker?: boolean
          first_landing_page?: string | null
          first_referrer?: string | null
          first_utm_campaign?: string | null
          first_utm_medium?: string | null
          first_utm_source?: string | null
          full_name?: string | null
          hire_date?: string | null
          hourly_rate?: number | null
          id?: string
          last_access?: string | null
          notes?: string | null
          notification_preferences?: Json | null
          onboarding_completed?: boolean | null
          organization_id?: string
          phone?: string | null
          position?: string | null
          rg?: string | null
          theme_mode?: string | null
          updated_at?: string
          user_id?: string
          whatsapp_ai_enabled?: boolean
          whatsapp_personal?: string | null
          whatsapp_signature?: string | null
          whatsapp_signature_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      recurrence_config: {
        Row: {
          automation_enabled: boolean
          business_hours_end: string
          business_hours_start: string
          created_at: string
          daily_limit: number
          id: string
          message_10_months: string | null
          message_12_months: string | null
          message_2_months: string | null
          message_4_months: string | null
          message_6_months: string | null
          message_8_months: string | null
          organization_id: string
          updated_at: string
        }
        Insert: {
          automation_enabled?: boolean
          business_hours_end?: string
          business_hours_start?: string
          created_at?: string
          daily_limit?: number
          id?: string
          message_10_months?: string | null
          message_12_months?: string | null
          message_2_months?: string | null
          message_4_months?: string | null
          message_6_months?: string | null
          message_8_months?: string | null
          organization_id: string
          updated_at?: string
        }
        Update: {
          automation_enabled?: boolean
          business_hours_end?: string
          business_hours_start?: string
          created_at?: string
          daily_limit?: number
          id?: string
          message_10_months?: string | null
          message_12_months?: string | null
          message_2_months?: string | null
          message_4_months?: string | null
          message_6_months?: string | null
          message_8_months?: string | null
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurrence_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      recurrence_entries: {
        Row: {
          client_id: string
          closed_at: string | null
          closed_reason: string | null
          created_at: string
          id: string
          is_active: boolean
          msg_10m_sent_at: string | null
          msg_12m_sent_at: string | null
          msg_2m_sent_at: string | null
          msg_4m_sent_at: string | null
          msg_6m_sent_at: string | null
          msg_8m_sent_at: string | null
          next_action_date: string | null
          organization_id: string
          source_completed_date: string
          source_service_id: string | null
          source_service_type: string
          source_value: number | null
          stage: string
          updated_at: string
        }
        Insert: {
          client_id: string
          closed_at?: string | null
          closed_reason?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          msg_10m_sent_at?: string | null
          msg_12m_sent_at?: string | null
          msg_2m_sent_at?: string | null
          msg_4m_sent_at?: string | null
          msg_6m_sent_at?: string | null
          msg_8m_sent_at?: string | null
          next_action_date?: string | null
          organization_id: string
          source_completed_date: string
          source_service_id?: string | null
          source_service_type: string
          source_value?: number | null
          stage?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          closed_at?: string | null
          closed_reason?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          msg_10m_sent_at?: string | null
          msg_12m_sent_at?: string | null
          msg_2m_sent_at?: string | null
          msg_4m_sent_at?: string | null
          msg_6m_sent_at?: string | null
          msg_8m_sent_at?: string | null
          next_action_date?: string | null
          organization_id?: string
          source_completed_date?: string
          source_service_id?: string | null
          source_service_type?: string
          source_value?: number | null
          stage?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurrence_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurrence_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurrence_entries_source_service_id_fkey"
            columns: ["source_service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      recurrence_message_log: {
        Row: {
          client_id: string | null
          content: string | null
          error_message: string | null
          id: string
          message_type: string
          organization_id: string
          recurrence_entry_id: string | null
          sent_at: string
          status: string
        }
        Insert: {
          client_id?: string | null
          content?: string | null
          error_message?: string | null
          id?: string
          message_type: string
          organization_id: string
          recurrence_entry_id?: string | null
          sent_at?: string
          status?: string
        }
        Update: {
          client_id?: string | null
          content?: string | null
          error_message?: string | null
          id?: string
          message_type?: string
          organization_id?: string
          recurrence_entry_id?: string | null
          sent_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurrence_message_log_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurrence_message_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurrence_message_log_recurrence_entry_id_fkey"
            columns: ["recurrence_entry_id"]
            isOneToOne: false
            referencedRelation: "recurrence_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      report_equipment: {
        Row: {
          capacity_btus: string | null
          cleanliness_status: string | null
          condition_found: string | null
          created_at: string
          equipment_brand: string | null
          equipment_condition: string | null
          equipment_location: string | null
          equipment_model: string | null
          equipment_number: number
          equipment_type: string | null
          equipment_working: string | null
          final_status: string | null
          id: string
          impact_level: string | null
          inspection_checklist: Json | null
          measurements: Json | null
          organization_id: string
          procedure_performed: string | null
          report_id: string
          serial_number: string | null
          services_performed: string | null
          technical_observations: string | null
          updated_at: string
        }
        Insert: {
          capacity_btus?: string | null
          cleanliness_status?: string | null
          condition_found?: string | null
          created_at?: string
          equipment_brand?: string | null
          equipment_condition?: string | null
          equipment_location?: string | null
          equipment_model?: string | null
          equipment_number?: number
          equipment_type?: string | null
          equipment_working?: string | null
          final_status?: string | null
          id?: string
          impact_level?: string | null
          inspection_checklist?: Json | null
          measurements?: Json | null
          organization_id: string
          procedure_performed?: string | null
          report_id: string
          serial_number?: string | null
          services_performed?: string | null
          technical_observations?: string | null
          updated_at?: string
        }
        Update: {
          capacity_btus?: string | null
          cleanliness_status?: string | null
          condition_found?: string | null
          created_at?: string
          equipment_brand?: string | null
          equipment_condition?: string | null
          equipment_location?: string | null
          equipment_model?: string | null
          equipment_number?: number
          equipment_type?: string | null
          equipment_working?: string | null
          final_status?: string | null
          id?: string
          impact_level?: string | null
          inspection_checklist?: Json | null
          measurements?: Json | null
          organization_id?: string
          procedure_performed?: string | null
          report_id?: string
          serial_number?: string | null
          services_performed?: string | null
          technical_observations?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_equipment_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_equipment_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "technical_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      service_equipment: {
        Row: {
          brand: string | null
          conditions: string | null
          created_at: string
          defects: string | null
          id: string
          model: string | null
          name: string
          organization_id: string
          serial_number: string | null
          service_id: string
          solution: string | null
          technical_report: string | null
          warranty_terms: string | null
        }
        Insert: {
          brand?: string | null
          conditions?: string | null
          created_at?: string
          defects?: string | null
          id?: string
          model?: string | null
          name?: string
          organization_id: string
          serial_number?: string | null
          service_id: string
          solution?: string | null
          technical_report?: string | null
          warranty_terms?: string | null
        }
        Update: {
          brand?: string | null
          conditions?: string | null
          created_at?: string
          defects?: string | null
          id?: string
          model?: string | null
          name?: string
          organization_id?: string
          serial_number?: string | null
          service_id?: string
          solution?: string | null
          technical_report?: string | null
          warranty_terms?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_equipment_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_equipment_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_execution_logs: {
        Row: {
          created_at: string
          event_type: string
          id: string
          organization_id: string
          recorded_at: string
          service_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          organization_id: string
          recorded_at?: string
          service_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          organization_id?: string
          recorded_at?: string
          service_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_execution_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_execution_logs_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_items: {
        Row: {
          catalog_service_id: string | null
          category: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          discount: number | null
          discount_type: string | null
          estimated_duration: string | null
          id: string
          is_non_standard: boolean | null
          name: string | null
          organization_id: string
          quantity: number
          service_id: string
          standard_checklist: Json | null
          unit_price: number
        }
        Insert: {
          catalog_service_id?: string | null
          category?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          discount?: number | null
          discount_type?: string | null
          estimated_duration?: string | null
          id?: string
          is_non_standard?: boolean | null
          name?: string | null
          organization_id: string
          quantity?: number
          service_id: string
          standard_checklist?: Json | null
          unit_price: number
        }
        Update: {
          catalog_service_id?: string | null
          category?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          discount?: number | null
          discount_type?: string | null
          estimated_duration?: string | null
          id?: string
          is_non_standard?: boolean | null
          name?: string | null
          organization_id?: string
          quantity?: number
          service_id?: string
          standard_checklist?: Json | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_items_catalog_service_id_fkey"
            columns: ["catalog_service_id"]
            isOneToOne: false
            referencedRelation: "catalog_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_payments: {
        Row: {
          amount: number
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          financial_account_id: string
          id: string
          is_confirmed: boolean
          organization_id: string
          payment_method: string
          registered_by: string | null
          service_id: string
        }
        Insert: {
          amount: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          financial_account_id: string
          id?: string
          is_confirmed?: boolean
          organization_id: string
          payment_method: string
          registered_by?: string | null
          service_id: string
        }
        Update: {
          amount?: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          financial_account_id?: string
          id?: string
          is_confirmed?: boolean
          organization_id?: string
          payment_method?: string
          registered_by?: string | null
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_payments_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_payments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_photos: {
        Row: {
          created_at: string
          description: string | null
          id: string
          organization_id: string
          photo_type: string | null
          photo_url: string
          service_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          organization_id: string
          photo_type?: string | null
          photo_url: string
          service_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          organization_id?: string
          photo_type?: string | null
          photo_url?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_photos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_photos_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_receipts: {
        Row: {
          client_name: string
          client_phone: string | null
          created_at: string
          id: string
          message: string
          organization_id: string
          payments_snapshot: Json | null
          quote_number: string | null
          sent_at: string | null
          sent_via: string | null
          service_description: string | null
          service_id: string
          service_value: number
          status: string
          updated_at: string
        }
        Insert: {
          client_name: string
          client_phone?: string | null
          created_at?: string
          id?: string
          message: string
          organization_id: string
          payments_snapshot?: Json | null
          quote_number?: string | null
          sent_at?: string | null
          sent_via?: string | null
          service_description?: string | null
          service_id: string
          service_value?: number
          status?: string
          updated_at?: string
        }
        Update: {
          client_name?: string
          client_phone?: string | null
          created_at?: string
          id?: string
          message?: string
          organization_id?: string
          payments_snapshot?: Json | null
          quote_number?: string | null
          sent_at?: string | null
          sent_via?: string | null
          service_description?: string | null
          service_id?: string
          service_value?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_receipts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_receipts_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_signatures: {
        Row: {
          created_at: string
          id: string
          ip_address: string | null
          organization_id: string
          service_id: string
          signature_url: string | null
          signed_at: string | null
          signer_name: string | null
          token: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address?: string | null
          organization_id: string
          service_id: string
          signature_url?: string | null
          signed_at?: string | null
          signer_name?: string | null
          token?: string
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string | null
          organization_id?: string
          service_id?: string
          signature_url?: string | null
          signed_at?: string | null
          signer_name?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_signatures_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_signatures_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_types: {
        Row: {
          created_at: string | null
          generates_recurrence: boolean | null
          id: string
          is_default: boolean | null
          name: string
          organization_id: string
          slug: string
        }
        Insert: {
          created_at?: string | null
          generates_recurrence?: boolean | null
          id?: string
          is_default?: boolean | null
          name: string
          organization_id: string
          slug: string
        }
        Update: {
          created_at?: string | null
          generates_recurrence?: boolean | null
          id?: string
          is_default?: boolean | null
          name?: string
          organization_id?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          assigned_to: string | null
          attendance_started_at: string | null
          client_id: string
          completed_date: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          document_type: string | null
          entry_date: string | null
          equipment_brand: string | null
          equipment_model: string | null
          equipment_type: string | null
          estimated_duration: string | null
          exit_date: string | null
          id: string
          internal_notes: string | null
          is_demo_data: boolean
          notes: string | null
          operational_status: string | null
          organization_id: string
          payment_conditions: string | null
          payment_due_date: string | null
          payment_method: string | null
          payment_notes: string | null
          priority: string | null
          quote_number: number
          quote_validity_days: number | null
          scheduled_date: string | null
          service_city: string | null
          service_complement: string | null
          service_neighborhood: string | null
          service_number: string | null
          service_state: string | null
          service_street: string | null
          service_type: string
          service_zip_code: string | null
          solution: string | null
          status: Database["public"]["Enums"]["service_status"]
          travel_started_at: string | null
          updated_at: string
          value: number | null
        }
        Insert: {
          assigned_to?: string | null
          attendance_started_at?: string | null
          client_id: string
          completed_date?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          document_type?: string | null
          entry_date?: string | null
          equipment_brand?: string | null
          equipment_model?: string | null
          equipment_type?: string | null
          estimated_duration?: string | null
          exit_date?: string | null
          id?: string
          internal_notes?: string | null
          is_demo_data?: boolean
          notes?: string | null
          operational_status?: string | null
          organization_id: string
          payment_conditions?: string | null
          payment_due_date?: string | null
          payment_method?: string | null
          payment_notes?: string | null
          priority?: string | null
          quote_number: number
          quote_validity_days?: number | null
          scheduled_date?: string | null
          service_city?: string | null
          service_complement?: string | null
          service_neighborhood?: string | null
          service_number?: string | null
          service_state?: string | null
          service_street?: string | null
          service_type: string
          service_zip_code?: string | null
          solution?: string | null
          status?: Database["public"]["Enums"]["service_status"]
          travel_started_at?: string | null
          updated_at?: string
          value?: number | null
        }
        Update: {
          assigned_to?: string | null
          attendance_started_at?: string | null
          client_id?: string
          completed_date?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          document_type?: string | null
          entry_date?: string | null
          equipment_brand?: string | null
          equipment_model?: string | null
          equipment_type?: string | null
          estimated_duration?: string | null
          exit_date?: string | null
          id?: string
          internal_notes?: string | null
          is_demo_data?: boolean
          notes?: string | null
          operational_status?: string | null
          organization_id?: string
          payment_conditions?: string | null
          payment_due_date?: string | null
          payment_method?: string | null
          payment_notes?: string | null
          priority?: string | null
          quote_number?: number
          quote_validity_days?: number | null
          scheduled_date?: string | null
          service_city?: string | null
          service_complement?: string | null
          service_neighborhood?: string | null
          service_number?: string | null
          service_state?: string | null
          service_street?: string | null
          service_type?: string
          service_zip_code?: string | null
          solution?: string | null
          status?: Database["public"]["Enums"]["service_status"]
          travel_started_at?: string | null
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "services_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_webhook_events: {
        Row: {
          event_id: string
          event_type: string
          id: string
          payload_summary: Json | null
          processed_at: string
        }
        Insert: {
          event_id: string
          event_type: string
          id?: string
          payload_summary?: Json | null
          processed_at?: string
        }
        Update: {
          event_id?: string
          event_type?: string
          id?: string
          payload_summary?: Json | null
          processed_at?: string
        }
        Relationships: []
      }
      super_admin_grants: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: string
          is_root: boolean
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          is_root?: boolean
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          is_root?: boolean
          user_id?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          category: string | null
          city: string | null
          cnpj_cpf: string | null
          complement: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          id: string
          name: string
          neighborhood: string | null
          notes: string | null
          number: string | null
          organization_id: string
          phone: string
          state: string | null
          street: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          category?: string | null
          city?: string | null
          cnpj_cpf?: string | null
          complement?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          name: string
          neighborhood?: string | null
          notes?: string | null
          number?: string | null
          organization_id: string
          phone: string
          state?: string | null
          street?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          category?: string | null
          city?: string | null
          cnpj_cpf?: string | null
          complement?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          name?: string
          neighborhood?: string | null
          notes?: string | null
          number?: string | null
          organization_id?: string
          phone?: string
          state?: string | null
          street?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      support_conversations: {
        Row: {
          created_at: string
          id: string
          organization_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          sender_type: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          sender_type: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "support_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      technical_report_photos: {
        Row: {
          caption: string | null
          category: string
          created_at: string
          equipment_id: string | null
          id: string
          organization_id: string
          photo_url: string
          report_id: string
          sort_order: number
        }
        Insert: {
          caption?: string | null
          category?: string
          created_at?: string
          equipment_id?: string | null
          id?: string
          organization_id: string
          photo_url: string
          report_id: string
          sort_order?: number
        }
        Update: {
          caption?: string | null
          category?: string
          created_at?: string
          equipment_id?: string | null
          id?: string
          organization_id?: string
          photo_url?: string
          report_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "technical_report_photos_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "service_equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technical_report_photos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technical_report_photos_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "technical_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      technical_reports: {
        Row: {
          capacity_btus: string | null
          cleanliness_status: string | null
          client_id: string
          conclusion: string | null
          created_at: string
          deleted_at: string | null
          diagnosis: string | null
          equipment_brand: string | null
          equipment_condition: string | null
          equipment_location: string | null
          equipment_model: string | null
          equipment_quantity: number | null
          equipment_type: string | null
          equipment_working: string | null
          id: string
          inspection_checklist: Json | null
          interventions_performed: string | null
          measurements: Json | null
          needs_quote: boolean | null
          observations: string | null
          organization_id: string
          quote_service_id: string | null
          recommendation: string | null
          report_date: string
          report_number: number
          responsible_technician_name: string | null
          risks: string | null
          serial_number: string | null
          service_id: string | null
          status: string
          technician_id: string | null
          updated_at: string
          visit_reason: string | null
        }
        Insert: {
          capacity_btus?: string | null
          cleanliness_status?: string | null
          client_id: string
          conclusion?: string | null
          created_at?: string
          deleted_at?: string | null
          diagnosis?: string | null
          equipment_brand?: string | null
          equipment_condition?: string | null
          equipment_location?: string | null
          equipment_model?: string | null
          equipment_quantity?: number | null
          equipment_type?: string | null
          equipment_working?: string | null
          id?: string
          inspection_checklist?: Json | null
          interventions_performed?: string | null
          measurements?: Json | null
          needs_quote?: boolean | null
          observations?: string | null
          organization_id: string
          quote_service_id?: string | null
          recommendation?: string | null
          report_date?: string
          report_number?: number
          responsible_technician_name?: string | null
          risks?: string | null
          serial_number?: string | null
          service_id?: string | null
          status?: string
          technician_id?: string | null
          updated_at?: string
          visit_reason?: string | null
        }
        Update: {
          capacity_btus?: string | null
          cleanliness_status?: string | null
          client_id?: string
          conclusion?: string | null
          created_at?: string
          deleted_at?: string | null
          diagnosis?: string | null
          equipment_brand?: string | null
          equipment_condition?: string | null
          equipment_location?: string | null
          equipment_model?: string | null
          equipment_quantity?: number | null
          equipment_type?: string | null
          equipment_working?: string | null
          id?: string
          inspection_checklist?: Json | null
          interventions_performed?: string | null
          measurements?: Json | null
          needs_quote?: boolean | null
          observations?: string | null
          organization_id?: string
          quote_service_id?: string | null
          recommendation?: string | null
          report_date?: string
          report_number?: number
          responsible_technician_name?: string | null
          risks?: string | null
          serial_number?: string | null
          service_id?: string | null
          status?: string
          technician_id?: string | null
          updated_at?: string
          visit_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "technical_reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technical_reports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technical_reports_quote_service_id_fkey"
            columns: ["quote_service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technical_reports_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      time_clock_adjustments: {
        Row: {
          adjusted_by: string
          adjustment_type: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          entry_id: string
          id: string
          new_time: string | null
          organization_id: string
          original_time: string | null
          post_closure: boolean
          reason: string
          request_reason: string | null
          requested_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          adjusted_by: string
          adjustment_type?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          entry_id: string
          id?: string
          new_time?: string | null
          organization_id: string
          original_time?: string | null
          post_closure?: boolean
          reason: string
          request_reason?: string | null
          requested_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          adjusted_by?: string
          adjustment_type?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          entry_id?: string
          id?: string
          new_time?: string | null
          organization_id?: string
          original_time?: string | null
          post_closure?: boolean
          reason?: string
          request_reason?: string | null
          requested_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_clock_adjustments_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "time_clock_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_clock_adjustments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      time_clock_audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          organization_id: string
          record_id: string | null
          subject_user_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          organization_id: string
          record_id?: string | null
          subject_user_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          organization_id?: string
          record_id?: string | null
          subject_user_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_clock_audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      time_clock_bank_hours: {
        Row: {
          added_minutes: number
          balance_minutes: number
          carried_from_previous: number
          closed: boolean
          created_at: string
          deducted_minutes: number
          id: string
          month: number
          organization_id: string
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          added_minutes?: number
          balance_minutes?: number
          carried_from_previous?: number
          closed?: boolean
          created_at?: string
          deducted_minutes?: number
          id?: string
          month: number
          organization_id: string
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          added_minutes?: number
          balance_minutes?: number
          carried_from_previous?: number
          closed?: boolean
          created_at?: string
          deducted_minutes?: number
          id?: string
          month?: number
          organization_id?: string
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "time_clock_bank_hours_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      time_clock_calendar_events: {
        Row: {
          created_at: string
          created_by: string | null
          end_date: string
          event_type: string
          id: string
          notes: string | null
          organization_id: string
          start_date: string
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_date: string
          event_type?: string
          id?: string
          notes?: string | null
          organization_id: string
          start_date: string
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_date?: string
          event_type?: string
          id?: string
          notes?: string | null
          organization_id?: string
          start_date?: string
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_clock_calendar_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      time_clock_entries: {
        Row: {
          created_at: string
          device_info: string | null
          entry_type: Database["public"]["Enums"]["time_clock_entry_type"]
          hash: string
          id: string
          ip_address: string | null
          latitude: number | null
          longitude: number | null
          organization_id: string
          photo_url: string | null
          previous_hash: string | null
          recorded_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_info?: string | null
          entry_type: Database["public"]["Enums"]["time_clock_entry_type"]
          hash?: string
          id?: string
          ip_address?: string | null
          latitude?: number | null
          longitude?: number | null
          organization_id: string
          photo_url?: string | null
          previous_hash?: string | null
          recorded_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_info?: string | null
          entry_type?: Database["public"]["Enums"]["time_clock_entry_type"]
          hash?: string
          id?: string
          ip_address?: string | null
          latitude?: number | null
          longitude?: number | null
          organization_id?: string
          photo_url?: string | null
          previous_hash?: string | null
          recorded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_clock_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      time_clock_inconsistencies: {
        Row: {
          auto_detected: boolean
          created_at: string
          description: string | null
          entry_date: string
          id: string
          organization_id: string
          requested_by: string | null
          review_note: string | null
          reviewed_by: string | null
          severity: string
          status: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_detected?: boolean
          created_at?: string
          description?: string | null
          entry_date: string
          id?: string
          organization_id: string
          requested_by?: string | null
          review_note?: string | null
          reviewed_by?: string | null
          severity?: string
          status?: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_detected?: boolean
          created_at?: string
          description?: string | null
          entry_date?: string
          id?: string
          organization_id?: string
          requested_by?: string | null
          review_note?: string | null
          reviewed_by?: string | null
          severity?: string
          status?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_clock_inconsistencies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      time_clock_month_closures: {
        Row: {
          bank_balance_minutes: number | null
          closed_at: string | null
          closed_by: string | null
          created_at: string
          estimated_cost: number | null
          id: string
          month: number
          organization_id: string
          reopened_at: string | null
          reopened_by: string | null
          total_absences: number | null
          total_expected_minutes: number | null
          total_lates: number | null
          total_overtime_minutes: number | null
          total_worked_minutes: number | null
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          bank_balance_minutes?: number | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          estimated_cost?: number | null
          id?: string
          month: number
          organization_id: string
          reopened_at?: string | null
          reopened_by?: string | null
          total_absences?: number | null
          total_expected_minutes?: number | null
          total_lates?: number | null
          total_overtime_minutes?: number | null
          total_worked_minutes?: number | null
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          bank_balance_minutes?: number | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          estimated_cost?: number | null
          id?: string
          month?: number
          organization_id?: string
          reopened_at?: string | null
          reopened_by?: string | null
          total_absences?: number | null
          total_expected_minutes?: number | null
          total_lates?: number | null
          total_overtime_minutes?: number | null
          total_worked_minutes?: number | null
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "time_clock_month_closures_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      time_clock_settings: {
        Row: {
          allowed_radius_meters: number | null
          consider_saturday_weekend: boolean
          created_at: string
          default_hourly_rate: number | null
          expected_clock_in: string | null
          flexible_schedule: boolean | null
          geolocation_required: boolean | null
          id: string
          late_tolerance_minutes: number
          min_break_minutes: number
          organization_id: string
          overtime_policy: string | null
          overtime_rate_weekday: number
          overtime_rate_weekend: number
          photo_required: boolean | null
          updated_at: string
          work_days: string[]
          work_hours_per_day: number
        }
        Insert: {
          allowed_radius_meters?: number | null
          consider_saturday_weekend?: boolean
          created_at?: string
          default_hourly_rate?: number | null
          expected_clock_in?: string | null
          flexible_schedule?: boolean | null
          geolocation_required?: boolean | null
          id?: string
          late_tolerance_minutes?: number
          min_break_minutes?: number
          organization_id: string
          overtime_policy?: string | null
          overtime_rate_weekday?: number
          overtime_rate_weekend?: number
          photo_required?: boolean | null
          updated_at?: string
          work_days?: string[]
          work_hours_per_day?: number
        }
        Update: {
          allowed_radius_meters?: number | null
          consider_saturday_weekend?: boolean
          created_at?: string
          default_hourly_rate?: number | null
          expected_clock_in?: string | null
          flexible_schedule?: boolean | null
          geolocation_required?: boolean | null
          id?: string
          late_tolerance_minutes?: number
          min_break_minutes?: number
          organization_id?: string
          overtime_policy?: string | null
          overtime_rate_weekday?: number
          overtime_rate_weekend?: number
          photo_required?: boolean | null
          updated_at?: string
          work_days?: string[]
          work_hours_per_day?: number
        }
        Relationships: [
          {
            foreignKeyName: "time_clock_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      time_clock_work_schedules: {
        Row: {
          break_minutes: number
          created_at: string
          employee_type: string | null
          expected_clock_in: string
          expected_clock_out: string
          hourly_rate: number | null
          id: string
          is_default: boolean
          organization_id: string
          schedule_name: string
          schedule_type: string
          updated_at: string
          user_id: string | null
          work_days: Json
          work_hours_per_day: number
        }
        Insert: {
          break_minutes?: number
          created_at?: string
          employee_type?: string | null
          expected_clock_in?: string
          expected_clock_out?: string
          hourly_rate?: number | null
          id?: string
          is_default?: boolean
          organization_id: string
          schedule_name?: string
          schedule_type?: string
          updated_at?: string
          user_id?: string | null
          work_days?: Json
          work_hours_per_day?: number
        }
        Update: {
          break_minutes?: number
          created_at?: string
          employee_type?: string | null
          expected_clock_in?: string
          expected_clock_out?: string
          hourly_rate?: number | null
          id?: string
          is_default?: boolean
          organization_id?: string
          schedule_name?: string
          schedule_type?: string
          updated_at?: string
          user_id?: string | null
          work_days?: Json
          work_hours_per_day?: number
        }
        Relationships: [
          {
            foreignKeyName: "time_clock_work_schedules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tracking_config: {
        Row: {
          consent_text: string | null
          created_at: string
          enabled: boolean
          id: string
          organization_id: string
          saturday_end_time: string | null
          saturday_start_time: string | null
          speed_limit_kmh: number
          track_saturday: boolean
          tracking_end_time: string
          tracking_start_time: string
          update_interval_seconds: number
          updated_at: string
        }
        Insert: {
          consent_text?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          organization_id: string
          saturday_end_time?: string | null
          saturday_start_time?: string | null
          speed_limit_kmh?: number
          track_saturday?: boolean
          tracking_end_time?: string
          tracking_start_time?: string
          update_interval_seconds?: number
          updated_at?: string
        }
        Update: {
          consent_text?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          organization_id?: string
          saturday_end_time?: string | null
          saturday_start_time?: string | null
          speed_limit_kmh?: number
          track_saturday?: boolean
          tracking_end_time?: string
          tracking_start_time?: string
          update_interval_seconds?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracking_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tracking_consent: {
        Row: {
          consent_version: string
          consented_at: string
          id: string
          ip_address: string | null
          organization_id: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          consent_version?: string
          consented_at?: string
          id?: string
          ip_address?: string | null
          organization_id: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          consent_version?: string
          consented_at?: string
          id?: string
          ip_address?: string | null
          organization_id?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracking_consent_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tracking_points: {
        Row: {
          accuracy: number | null
          created_at: string
          heading: number | null
          id: string
          latitude: number
          longitude: number
          organization_id: string
          recorded_at: string
          session_date: string
          speed_kmh: number | null
          user_id: string
        }
        Insert: {
          accuracy?: number | null
          created_at?: string
          heading?: number | null
          id?: string
          latitude: number
          longitude: number
          organization_id: string
          recorded_at?: string
          session_date?: string
          speed_kmh?: number | null
          user_id: string
        }
        Update: {
          accuracy?: number | null
          created_at?: string
          heading?: number | null
          id?: string
          latitude?: number
          longitude?: number
          organization_id?: string
          recorded_at?: string
          session_date?: string
          speed_kmh?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracking_points_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_categories: {
        Row: {
          created_at: string | null
          id: string
          is_default: boolean | null
          name: string
          organization_id: string
          parent_id: string | null
          slug: string
          type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          organization_id: string
          parent_id?: string | null
          slug: string
          type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          organization_id?: string
          parent_id?: string | null
          slug?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "transaction_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_status_log: {
        Row: {
          changed_at: string
          changed_by: string
          id: string
          new_status: string
          organization_id: string
          previous_status: string
          transaction_id: string
        }
        Insert: {
          changed_at?: string
          changed_by: string
          id?: string
          new_status: string
          organization_id: string
          previous_status: string
          transaction_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string
          id?: string
          new_status?: string
          organization_id?: string
          previous_status?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_status_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_status_log_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          category: string
          client_id: string | null
          compensation_date: string | null
          created_at: string
          date: string
          deleted_at: string | null
          description: string
          due_date: string | null
          employee_id: string | null
          financial_account_id: string | null
          id: string
          is_demo_data: boolean
          notes: string | null
          organization_id: string
          payment_date: string | null
          payment_method: string | null
          payment_source_type: string | null
          recurrence: string | null
          service_id: string | null
          status: string | null
          supplier_id: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
        }
        Insert: {
          amount: number
          category: string
          client_id?: string | null
          compensation_date?: string | null
          created_at?: string
          date?: string
          deleted_at?: string | null
          description: string
          due_date?: string | null
          employee_id?: string | null
          financial_account_id?: string | null
          id?: string
          is_demo_data?: boolean
          notes?: string | null
          organization_id: string
          payment_date?: string | null
          payment_method?: string | null
          payment_source_type?: string | null
          recurrence?: string | null
          service_id?: string | null
          status?: string | null
          supplier_id?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          client_id?: string | null
          compensation_date?: string | null
          created_at?: string
          date?: string
          deleted_at?: string | null
          description?: string
          due_date?: string | null
          employee_id?: string | null
          financial_account_id?: string | null
          id?: string
          is_demo_data?: boolean
          notes?: string | null
          organization_id?: string
          payment_date?: string | null
          payment_method?: string | null
          payment_source_type?: string | null
          recurrence?: string | null
          service_id?: string | null
          status?: string | null
          supplier_id?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "transactions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "transactions_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_activity_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          organization_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          organization_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          organization_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_activity_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_journey_state: {
        Row: {
          created_at: string
          current_step: string | null
          id: string
          journey_ended_at: string | null
          journey_started_at: string
          journey_type: string
          last_automation_id: string | null
          last_sent_at: string | null
          last_sent_date: string | null
          metadata: Json | null
          organization_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_step?: string | null
          id?: string
          journey_ended_at?: string | null
          journey_started_at?: string
          journey_type?: string
          last_automation_id?: string | null
          last_sent_at?: string | null
          last_sent_date?: string | null
          metadata?: Json | null
          organization_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_step?: string | null
          id?: string
          journey_ended_at?: string | null
          journey_started_at?: string
          journey_type?: string
          last_automation_id?: string | null
          last_sent_at?: string | null
          last_sent_date?: string | null
          metadata?: Json | null
          organization_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_journey_state_last_automation_id_fkey"
            columns: ["last_automation_id"]
            isOneToOne: false
            referencedRelation: "analytics_automations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_organizations: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_organizations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sessions: {
        Row: {
          anonymous_id: string | null
          duration_seconds: number
          ended_at: string
          id: string
          landing_page: string | null
          organization_id: string | null
          referrer: string | null
          started_at: string
          user_id: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          anonymous_id?: string | null
          duration_seconds?: number
          ended_at?: string
          id?: string
          landing_page?: string | null
          organization_id?: string | null
          referrer?: string | null
          started_at?: string
          user_id?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          anonymous_id?: string | null
          duration_seconds?: number
          ended_at?: string
          id?: string
          landing_page?: string | null
          organization_id?: string | null
          referrer?: string | null
          started_at?: string
          user_id?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      webchat_configs: {
        Row: {
          auto_show_welcome: boolean
          avatar_url: string | null
          bottom_distance: number
          button_text: string | null
          color: string
          created_at: string
          display_name: string | null
          id: string
          is_active: boolean
          organization_id: string
          position: string
          updated_at: string
          welcome_message: string | null
        }
        Insert: {
          auto_show_welcome?: boolean
          avatar_url?: string | null
          bottom_distance?: number
          button_text?: string | null
          color?: string
          created_at?: string
          display_name?: string | null
          id?: string
          is_active?: boolean
          organization_id: string
          position?: string
          updated_at?: string
          welcome_message?: string | null
        }
        Update: {
          auto_show_welcome?: boolean
          avatar_url?: string | null
          bottom_distance?: number
          button_text?: string | null
          color?: string
          created_at?: string
          display_name?: string | null
          id?: string
          is_active?: boolean
          organization_id?: string
          position?: string
          updated_at?: string
          welcome_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webchat_configs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_ai_pins: {
        Row: {
          attempts: number
          created_at: string
          expires_at: string
          id: string
          is_verified: boolean
          max_attempts: number
          organization_id: string
          pin_hash: string
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          expires_at?: string
          id?: string
          is_verified?: boolean
          max_attempts?: number
          organization_id: string
          pin_hash: string
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          expires_at?: string
          id?: string
          is_verified?: boolean
          max_attempts?: number
          organization_id?: string
          pin_hash?: string
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_ai_pins_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_ai_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          organization_id: string
          phone_number: string
          verified_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          organization_id: string
          phone_number: string
          verified_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          organization_id?: string
          phone_number?: string
          verified_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_ai_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_automations: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          message_template: string
          name: string
          organization_id: string
          trigger_config: Json | null
          trigger_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          message_template?: string
          name: string
          organization_id: string
          trigger_config?: Json | null
          trigger_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          message_template?: string
          name?: string
          organization_id?: string
          trigger_config?: Json | null
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_automations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_bot_connections: {
        Row: {
          bot_id: string
          condition_branch: string | null
          from_step_id: string | null
          id: string
          to_step_id: string
        }
        Insert: {
          bot_id: string
          condition_branch?: string | null
          from_step_id?: string | null
          id?: string
          to_step_id: string
        }
        Update: {
          bot_id?: string
          condition_branch?: string | null
          from_step_id?: string | null
          id?: string
          to_step_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_bot_connections_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_bot_connections_from_step_id_fkey"
            columns: ["from_step_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_bot_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_bot_connections_to_step_id_fkey"
            columns: ["to_step_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_bot_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_bot_execution_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          execution_id: string
          id: string
          step_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          execution_id: string
          id?: string
          step_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          execution_id?: string
          id?: string
          step_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_bot_execution_logs_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_bot_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_bot_execution_logs_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_bot_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_bot_executions: {
        Row: {
          bot_id: string
          completed_at: string | null
          contact_id: string
          current_step_id: string | null
          error_message: string | null
          id: string
          organization_id: string
          started_at: string | null
          status: string | null
          wait_until: string | null
        }
        Insert: {
          bot_id: string
          completed_at?: string | null
          contact_id: string
          current_step_id?: string | null
          error_message?: string | null
          id?: string
          organization_id: string
          started_at?: string | null
          status?: string | null
          wait_until?: string | null
        }
        Update: {
          bot_id?: string
          completed_at?: string | null
          contact_id?: string
          current_step_id?: string | null
          error_message?: string | null
          id?: string
          organization_id?: string
          started_at?: string | null
          status?: string | null
          wait_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_bot_executions_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_bot_executions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_bot_executions_current_step_id_fkey"
            columns: ["current_step_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_bot_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_bot_executions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_bot_steps: {
        Row: {
          bot_id: string
          config: Json | null
          created_at: string | null
          id: string
          label: string | null
          position_x: number | null
          position_y: number | null
          step_type: string
        }
        Insert: {
          bot_id: string
          config?: Json | null
          created_at?: string | null
          id?: string
          label?: string | null
          position_x?: number | null
          position_y?: number | null
          step_type: string
        }
        Update: {
          bot_id?: string
          config?: Json | null
          created_at?: string | null
          id?: string
          label?: string | null
          position_x?: number | null
          position_y?: number | null
          step_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_bot_steps_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_bots"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_bots: {
        Row: {
          created_at: string | null
          description: string | null
          execution_count: number | null
          id: string
          is_active: boolean | null
          last_executed_at: string | null
          name: string
          organization_id: string
          trigger_config: Json | null
          trigger_type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          execution_count?: number | null
          id?: string
          is_active?: boolean | null
          last_executed_at?: string | null
          name: string
          organization_id: string
          trigger_config?: Json | null
          trigger_type?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          execution_count?: number | null
          id?: string
          is_active?: boolean | null
          last_executed_at?: string | null
          name?: string
          organization_id?: string
          trigger_config?: Json | null
          trigger_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_bots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_channel_transitions: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          metadata: Json | null
          new_channel_id: string | null
          organization_id: string
          previous_channel_id: string | null
          reason: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          new_channel_id?: string | null
          organization_id: string
          previous_channel_id?: string | null
          reason?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          new_channel_id?: string | null
          organization_id?: string
          previous_channel_id?: string | null
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_channel_transitions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_channels: {
        Row: {
          access_token: string | null
          channel_status: string
          channel_type: string
          color: string
          created_at: string
          disconnected_reason: string | null
          id: string
          instance_name: string | null
          integration_type: string
          is_connected: boolean
          last_connected_at: string | null
          name: string
          organization_id: string
          owner_jid: string | null
          phone_number: string | null
          phone_number_id: string | null
          updated_at: string
          waba_id: string | null
        }
        Insert: {
          access_token?: string | null
          channel_status?: string
          channel_type?: string
          color?: string
          created_at?: string
          disconnected_reason?: string | null
          id?: string
          instance_name?: string | null
          integration_type?: string
          is_connected?: boolean
          last_connected_at?: string | null
          name: string
          organization_id: string
          owner_jid?: string | null
          phone_number?: string | null
          phone_number_id?: string | null
          updated_at?: string
          waba_id?: string | null
        }
        Update: {
          access_token?: string | null
          channel_status?: string
          channel_type?: string
          color?: string
          created_at?: string
          disconnected_reason?: string | null
          id?: string
          instance_name?: string | null
          integration_type?: string
          is_connected?: boolean
          last_connected_at?: string | null
          name?: string
          organization_id?: string
          owner_jid?: string | null
          phone_number?: string | null
          phone_number_id?: string | null
          updated_at?: string
          waba_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_channels_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_chat_history: {
        Row: {
          content: string
          created_at: string
          id: string
          organization_id: string
          phone_number: string
          role: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          organization_id: string
          phone_number: string
          role: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          organization_id?: string
          phone_number?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_chat_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_chatbot_flows: {
        Row: {
          channel_id: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          priority: number
          trigger_config: Json
          trigger_type: string
          updated_at: string
        }
        Insert: {
          channel_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          priority?: number
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
        }
        Update: {
          channel_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          priority?: number
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_chatbot_flows_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_chatbot_flows_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_channels_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_chatbot_flows_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_chatbot_sessions: {
        Row: {
          contact_id: string | null
          current_step_order: number
          flow_id: string
          id: string
          organization_id: string
          resume_at: string | null
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          contact_id?: string | null
          current_step_order?: number
          flow_id: string
          id?: string
          organization_id: string
          resume_at?: string | null
          started_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          contact_id?: string | null
          current_step_order?: number
          flow_id?: string
          id?: string
          organization_id?: string
          resume_at?: string | null
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_chatbot_sessions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_chatbot_sessions_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_chatbot_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_chatbot_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_chatbot_steps: {
        Row: {
          config: Json
          created_at: string
          flow_id: string
          id: string
          organization_id: string
          step_order: number
          step_type: string
        }
        Insert: {
          config?: Json
          created_at?: string
          flow_id: string
          id?: string
          organization_id: string
          step_order?: number
          step_type?: string
        }
        Update: {
          config?: Json
          created_at?: string
          flow_id?: string
          id?: string
          organization_id?: string
          step_order?: number
          step_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_chatbot_steps_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_chatbot_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_chatbot_steps_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_contact_labels: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          label_id: string
          organization_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          label_id: string
          organization_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          label_id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_contact_labels_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_contact_labels_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_labels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_contact_labels_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_contacts: {
        Row: {
          assigned_to: string | null
          channel_id: string | null
          conversation_status: string
          conversion_status: string | null
          created_at: string
          has_conversation: boolean
          id: string
          internal_note: string | null
          is_blocked: boolean
          is_group: boolean
          is_name_custom: boolean
          is_private: boolean
          is_unread: boolean
          last_message_at: string | null
          last_message_content: string | null
          last_message_is_from_me: boolean | null
          linked_at: string | null
          linked_client_id: string | null
          linked_service_id: string | null
          name: string | null
          needs_resolution: boolean
          normalized_phone: string | null
          organization_id: string
          phone: string | null
          profile_picture_url: string | null
          source: string | null
          tags: string[] | null
          unread_count: number
          updated_at: string
          visitor_metadata: Json | null
          whatsapp_id: string
        }
        Insert: {
          assigned_to?: string | null
          channel_id?: string | null
          conversation_status?: string
          conversion_status?: string | null
          created_at?: string
          has_conversation?: boolean
          id?: string
          internal_note?: string | null
          is_blocked?: boolean
          is_group?: boolean
          is_name_custom?: boolean
          is_private?: boolean
          is_unread?: boolean
          last_message_at?: string | null
          last_message_content?: string | null
          last_message_is_from_me?: boolean | null
          linked_at?: string | null
          linked_client_id?: string | null
          linked_service_id?: string | null
          name?: string | null
          needs_resolution?: boolean
          normalized_phone?: string | null
          organization_id: string
          phone?: string | null
          profile_picture_url?: string | null
          source?: string | null
          tags?: string[] | null
          unread_count?: number
          updated_at?: string
          visitor_metadata?: Json | null
          whatsapp_id: string
        }
        Update: {
          assigned_to?: string | null
          channel_id?: string | null
          conversation_status?: string
          conversion_status?: string | null
          created_at?: string
          has_conversation?: boolean
          id?: string
          internal_note?: string | null
          is_blocked?: boolean
          is_group?: boolean
          is_name_custom?: boolean
          is_private?: boolean
          is_unread?: boolean
          last_message_at?: string | null
          last_message_content?: string | null
          last_message_is_from_me?: boolean | null
          linked_at?: string | null
          linked_client_id?: string | null
          linked_service_id?: string | null
          name?: string | null
          needs_resolution?: boolean
          normalized_phone?: string | null
          organization_id?: string
          phone?: string | null
          profile_picture_url?: string | null
          source?: string | null
          tags?: string[] | null
          unread_count?: number
          updated_at?: string
          visitor_metadata?: Json | null
          whatsapp_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_contacts_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_contacts_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_channels_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_contacts_linked_client_id_fkey"
            columns: ["linked_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_contacts_linked_service_id_fkey"
            columns: ["linked_service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_instances: {
        Row: {
          company_id: string
          created_at: string
          id: string
          instance_name: string
          status: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          instance_name: string
          status?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          instance_name?: string
          status?: string
        }
        Relationships: []
      }
      whatsapp_labels: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          organization_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          organization_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_labels_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_message_audit: {
        Row: {
          action: string
          created_at: string
          id: string
          message_id: string
          new_content: string | null
          organization_id: string
          original_content: string | null
          performed_by: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          message_id: string
          new_content?: string | null
          organization_id: string
          original_content?: string | null
          performed_by: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          message_id?: string
          new_content?: string | null
          organization_id?: string
          original_content?: string | null
          performed_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_message_audit_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_message_log: {
        Row: {
          blocked_reason: string | null
          channel_id: string | null
          contact_id: string | null
          created_at: string
          id: string
          message_preview: string | null
          organization_id: string
          recipient_role: string | null
          recipient_user_id: string | null
          source: string
          status: string
        }
        Insert: {
          blocked_reason?: string | null
          channel_id?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          message_preview?: string | null
          organization_id: string
          recipient_role?: string | null
          recipient_user_id?: string | null
          source: string
          status?: string
        }
        Update: {
          blocked_reason?: string | null
          channel_id?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          message_preview?: string | null
          organization_id?: string
          recipient_role?: string | null
          recipient_user_id?: string | null
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_message_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          ai_generated: boolean | null
          channel_id: string | null
          contact_id: string
          content: string | null
          created_at: string
          id: string
          is_from_me: boolean
          media_type: string | null
          media_url: string | null
          message_id: string
          organization_id: string
          reactions: Json | null
          reply_to_content: string | null
          reply_to_id: string | null
          reply_to_message_id: string | null
          reply_to_sender: string | null
          sender_name: string | null
          sender_phone: string | null
          source: string | null
          status: string | null
          timestamp: string
        }
        Insert: {
          ai_generated?: boolean | null
          channel_id?: string | null
          contact_id: string
          content?: string | null
          created_at?: string
          id?: string
          is_from_me?: boolean
          media_type?: string | null
          media_url?: string | null
          message_id: string
          organization_id: string
          reactions?: Json | null
          reply_to_content?: string | null
          reply_to_id?: string | null
          reply_to_message_id?: string | null
          reply_to_sender?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          source?: string | null
          status?: string | null
          timestamp?: string
        }
        Update: {
          ai_generated?: boolean | null
          channel_id?: string | null
          contact_id?: string
          content?: string | null
          created_at?: string
          id?: string
          is_from_me?: boolean
          media_type?: string | null
          media_url?: string | null
          message_id?: string
          organization_id?: string
          reactions?: Json | null
          reply_to_content?: string | null
          reply_to_id?: string | null
          reply_to_message_id?: string | null
          reply_to_sender?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          source?: string | null
          status?: string | null
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_channels_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_quick_messages: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          organization_id: string
          shortcut: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          id?: string
          organization_id: string
          shortcut?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          organization_id?: string
          shortcut?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_quick_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_scheduled_messages: {
        Row: {
          channel_id: string
          contact_id: string
          content: string
          created_at: string
          created_by: string
          error_message: string | null
          id: string
          organization_id: string
          scheduled_at: string
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          channel_id: string
          contact_id: string
          content: string
          created_at?: string
          created_by: string
          error_message?: string | null
          id?: string
          organization_id: string
          scheduled_at: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          channel_id?: string
          contact_id?: string
          content?: string
          created_at?: string
          created_by?: string
          error_message?: string | null
          id?: string
          organization_id?: string
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_scheduled_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_scheduled_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_channels_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_scheduled_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_scheduled_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_tags: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          organization_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          organization_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_tags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_transfer_log: {
        Row: {
          action: string
          contact_id: string
          created_at: string
          from_user_id: string | null
          id: string
          organization_id: string
          to_user_id: string | null
        }
        Insert: {
          action?: string
          contact_id: string
          created_at?: string
          from_user_id?: string | null
          id?: string
          organization_id: string
          to_user_id?: string | null
        }
        Update: {
          action?: string
          contact_id?: string
          created_at?: string
          from_user_id?: string | null
          id?: string
          organization_id?: string
          to_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_transfer_log_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_transfer_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      profiles_safe: {
        Row: {
          address_cep: string | null
          address_city: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          ai_assistant_name: string | null
          ai_assistant_voice: string | null
          avatar_url: string | null
          birth_date: string | null
          cpf: string | null
          created_at: string | null
          dashboard_layout: Json | null
          demo_tour_completed: boolean | null
          employee_type: string | null
          field_worker: boolean | null
          first_landing_page: string | null
          first_referrer: string | null
          first_utm_campaign: string | null
          first_utm_medium: string | null
          first_utm_source: string | null
          full_name: string | null
          hire_date: string | null
          hourly_rate: number | null
          id: string | null
          last_access: string | null
          notes: string | null
          notification_preferences: Json | null
          onboarding_completed: boolean | null
          organization_id: string | null
          phone: string | null
          position: string | null
          rg: string | null
          updated_at: string | null
          user_id: string | null
          whatsapp_ai_enabled: boolean | null
          whatsapp_personal: string | null
          whatsapp_signature: string | null
          whatsapp_signature_enabled: boolean | null
        }
        Insert: {
          address_cep?: string | null
          address_city?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          ai_assistant_name?: string | null
          ai_assistant_voice?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          cpf?: string | null
          created_at?: string | null
          dashboard_layout?: Json | null
          demo_tour_completed?: boolean | null
          employee_type?: string | null
          field_worker?: boolean | null
          first_landing_page?: string | null
          first_referrer?: string | null
          first_utm_campaign?: string | null
          first_utm_medium?: string | null
          first_utm_source?: string | null
          full_name?: string | null
          hire_date?: string | null
          hourly_rate?: number | null
          id?: string | null
          last_access?: string | null
          notes?: string | null
          notification_preferences?: Json | null
          onboarding_completed?: boolean | null
          organization_id?: string | null
          phone?: string | null
          position?: string | null
          rg?: string | null
          updated_at?: string | null
          user_id?: string | null
          whatsapp_ai_enabled?: boolean | null
          whatsapp_personal?: string | null
          whatsapp_signature?: string | null
          whatsapp_signature_enabled?: boolean | null
        }
        Update: {
          address_cep?: string | null
          address_city?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          ai_assistant_name?: string | null
          ai_assistant_voice?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          cpf?: string | null
          created_at?: string | null
          dashboard_layout?: Json | null
          demo_tour_completed?: boolean | null
          employee_type?: string | null
          field_worker?: boolean | null
          first_landing_page?: string | null
          first_referrer?: string | null
          first_utm_campaign?: string | null
          first_utm_medium?: string | null
          first_utm_source?: string | null
          full_name?: string | null
          hire_date?: string | null
          hourly_rate?: number | null
          id?: string | null
          last_access?: string | null
          notes?: string | null
          notification_preferences?: Json | null
          onboarding_completed?: boolean | null
          organization_id?: string | null
          phone?: string | null
          position?: string | null
          rg?: string | null
          updated_at?: string | null
          user_id?: string | null
          whatsapp_ai_enabled?: boolean | null
          whatsapp_personal?: string | null
          whatsapp_signature?: string | null
          whatsapp_signature_enabled?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      view_analytics_ab_test_results: {
        Row: {
          conversion_rate: number | null
          test_id: string | null
          test_name: string | null
          total_conversions: number | null
          total_users: number | null
          variant_id: string | null
          variant_name: string | null
        }
        Relationships: []
      }
      view_analytics_activation_metrics: {
        Row: {
          activated_24h: number | null
          avg_hours_to_activation: number | null
          total_activated: number | null
          total_users: number | null
        }
        Relationships: []
      }
      view_analytics_cta_performance: {
        Row: {
          click_count: number | null
          cta_location: string | null
          cta_plan: string | null
        }
        Relationships: []
      }
      view_analytics_daily_metrics: {
        Row: {
          avg_session_duration: number | null
          conversion_rate: number | null
          day: string | null
          page_views: number | null
          signups_completed: number | null
          signups_started: number | null
          total_sessions: number | null
          unique_visitors: number | null
        }
        Relationships: []
      }
      view_analytics_events: {
        Row: {
          created_at: string | null
          duration_on_previous_page: number | null
          event_type: string | null
          id: string | null
          metadata: Json | null
          organization_id: string | null
          page_path: string | null
          page_title: string | null
          user_id: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          created_at?: string | null
          duration_on_previous_page?: never
          event_type?: string | null
          id?: string | null
          metadata?: Json | null
          organization_id?: string | null
          page_path?: never
          page_title?: never
          user_id?: string | null
          utm_campaign?: never
          utm_medium?: never
          utm_source?: never
        }
        Update: {
          created_at?: string | null
          duration_on_previous_page?: never
          event_type?: string | null
          id?: string | null
          metadata?: Json | null
          organization_id?: string | null
          page_path?: never
          page_title?: never
          user_id?: string | null
          utm_campaign?: never
          utm_medium?: never
          utm_source?: never
        }
        Relationships: [
          {
            foreignKeyName: "user_activity_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      view_analytics_funnel: {
        Row: {
          first_action: number | null
          first_login: number | null
          landing_page: number | null
          signup_completed: number | null
          signup_started: number | null
          total_entries: number | null
        }
        Relationships: []
      }
      view_analytics_funnel_advanced: {
        Row: {
          activated: number | null
          first_action: number | null
          first_login: number | null
          landing_page: number | null
          signup_completed: number | null
          signup_started: number | null
          subscription_completed: number | null
          subscription_started: number | null
        }
        Relationships: []
      }
      view_analytics_lead_dropoffs: {
        Row: {
          dropoff_count: number | null
          last_page: string | null
        }
        Relationships: []
      }
      view_analytics_lead_paths: {
        Row: {
          interaction_count: number | null
          path: string | null
          total_time_seconds: number | null
          visitor_id: string | null
        }
        Relationships: []
      }
      view_analytics_marketing_funnel: {
        Row: {
          avg_time_to_signup_seconds: number | null
          cta_click_rate: number | null
          cta_clicks: number | null
          final_conversion_rate: number | null
          interactions: number | null
          landing_page_views: number | null
          payments_completed: number | null
          payments_initiated: number | null
          signup_completion_rate: number | null
          signup_start_rate: number | null
          signups_completed: number | null
          signups_started: number | null
          total_visitors: number | null
        }
        Relationships: []
      }
      view_analytics_pages: {
        Row: {
          avg_duration_on_page: number | null
          page_path: string | null
          page_title: string | null
          total_views: number | null
          unique_views: number | null
        }
        Relationships: []
      }
      view_analytics_retention_cohorts: {
        Row: {
          active_users: number | null
          activity_month: string | null
          cohort_month: string | null
          month_number: number | null
        }
        Relationships: []
      }
      view_analytics_sessions: {
        Row: {
          anonymous_id: string | null
          duration_seconds: number | null
          ended_at: string | null
          id: string | null
          landing_page: string | null
          organization_id: string | null
          referrer: string | null
          started_at: string | null
          user_id: string | null
          user_status: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          anonymous_id?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string | null
          landing_page?: string | null
          organization_id?: string | null
          referrer?: string | null
          started_at?: string | null
          user_id?: string | null
          user_status?: never
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          anonymous_id?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string | null
          landing_page?: string | null
          organization_id?: string | null
          referrer?: string | null
          started_at?: string | null
          user_id?: string | null
          user_status?: never
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      view_analytics_traffic_sources: {
        Row: {
          campaign: string | null
          medium: string | null
          session_count: number | null
          source: string | null
          user_count: number | null
        }
        Relationships: []
      }
      view_analytics_unified_events: {
        Row: {
          created_at: string | null
          event_type: string | null
          id: string | null
          metadata: Json | null
          organization_id: string | null
          user_id: string | null
        }
        Relationships: []
      }
      view_analytics_user_scores: {
        Row: {
          active_days_30d: number | null
          classification: string | null
          full_name: string | null
          is_churn_risk: boolean | null
          joined_at: string | null
          last_active_at: string | null
          organization_id: string | null
          total_events_30d: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      view_campaign_comparison: {
        Row: {
          campaign: string | null
          conversion_rate: number | null
          conversions: number | null
          medium: string | null
          session_count: number | null
          signups: number | null
          source: string | null
        }
        Relationships: []
      }
      view_lead_journeys_summary: {
        Row: {
          campaign: string | null
          clicked_cta: boolean | null
          first_seen: string | null
          last_page: string | null
          last_seen: string | null
          medium: string | null
          source: string | null
          total_duration_seconds: number | null
          total_events: number | null
          unique_pages: number | null
          visitor_id: string | null
        }
        Relationships: []
      }
      whatsapp_channels_safe: {
        Row: {
          channel_status: string | null
          channel_type: string | null
          color: string | null
          created_at: string | null
          disconnected_reason: string | null
          id: string | null
          instance_name: string | null
          integration_type: string | null
          is_connected: boolean | null
          last_connected_at: string | null
          name: string | null
          organization_id: string | null
          owner_jid: string | null
          phone_number: string | null
          phone_number_id: string | null
          updated_at: string | null
          waba_id: string | null
        }
        Insert: {
          channel_status?: string | null
          channel_type?: string | null
          color?: string | null
          created_at?: string | null
          disconnected_reason?: string | null
          id?: string | null
          instance_name?: string | null
          integration_type?: string | null
          is_connected?: boolean | null
          last_connected_at?: string | null
          name?: string | null
          organization_id?: string | null
          owner_jid?: string | null
          phone_number?: string | null
          phone_number_id?: string | null
          updated_at?: string | null
          waba_id?: string | null
        }
        Update: {
          channel_status?: string | null
          channel_type?: string | null
          color?: string | null
          created_at?: string | null
          disconnected_reason?: string | null
          id?: string | null
          instance_name?: string | null
          integration_type?: string | null
          is_connected?: boolean | null
          last_connected_at?: string | null
          name?: string | null
          organization_id?: string | null
          owner_jid?: string | null
          phone_number?: string | null
          phone_number_id?: string | null
          updated_at?: string | null
          waba_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_channels_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_ai_credits: {
        Args: {
          _action_type: string
          _amount: number
          _description: string
          _org_id: string
          _user_id?: string
        }
        Returns: number
      }
      adjust_financial_account_balance: {
        Args: { _account_id: string; _delta: number }
        Returns: number
      }
      calculate_service_total_duration: {
        Args: { s_id: string }
        Returns: string
      }
      can_create_service: { Args: { org_id: string }; Returns: boolean }
      can_modify: { Args: { _user_id: string }; Returns: boolean }
      check_analytics_anomalies: { Args: never; Returns: undefined }
      check_send_limit: {
        Args: { _contact_id?: string; _org_id: string; _source?: string }
        Returns: Json
      }
      cleanup_soft_deleted_records: { Args: never; Returns: undefined }
      complete_service_with_payments: {
        Args: {
          _completed_date?: string
          _org_id: string
          _payments?: Json
          _service_id: string
        }
        Returns: Json
      }
      consume_ai_credits: {
        Args: { _action_slug: string; _org_id: string; _user_id?: string }
        Returns: boolean
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      generate_demo_data: { Args: { _org_id: string }; Returns: undefined }
      get_all_platform_users: {
        Args: never
        Returns: {
          created_at: string
          email: string
          full_name: string
          last_access: string
          org_city: string
          org_cnpj_cpf: string
          org_state: string
          organization_id: string
          organization_name: string
          phone: string
          plan: string
          plan_expires_at: string
          roles: string[]
          trial_ends_at: string
          trial_started_at: string
          user_id: string
        }[]
      }
      get_company_health_indicators: {
        Args: { _is_demo?: boolean; _org_id: string }
        Returns: Json
      }
      get_dashboard_stats: {
        Args: {
          _end_date: string
          _is_demo?: boolean
          _org_id: string
          _prev_end_date: string
          _prev_start_date: string
          _start_date: string
        }
        Returns: Json
      }
      get_invite_by_token: {
        Args: { invite_token: string }
        Returns: {
          email: string
          id: string
          organization_id: string
          organization_name: string
          role: Database["public"]["Enums"]["app_role"]
          token: string
        }[]
      }
      get_lead_journey_timeline: {
        Args: { p_visitor_id: string }
        Returns: {
          created_at: string
          duration_on_page: number
          event_type: string
          metadata: Json
          page_path: string
          page_title: string
        }[]
      }
      get_portal_config_by_slug: {
        Args: { _slug: string }
        Returns: {
          contact_phone: string
          display_name: string
          is_active: boolean
          logo_url: string
          organization_id: string
          primary_color: string
          secondary_color: string
          welcome_message: string
        }[]
      }
      get_signature_by_token: {
        Args: { p_token: string }
        Returns: {
          organization_id: string
          service_id: string
          signature_url: string
          signed_at: string
          signer_name: string
          token: string
        }[]
      }
      get_team_profiles_safe: {
        Args: { org_id: string }
        Returns: {
          profile_avatar_url: string
          profile_employee_type: string
          profile_field_worker: boolean
          profile_full_name: string
          profile_id: string
          profile_last_access: string
          profile_organization_id: string
          profile_phone: string
          profile_position: string
          profile_user_id: string
        }[]
      }
      get_user_engagement_metrics: {
        Args: never
        Returns: {
          accesses_30d: number
          accesses_7d: number
          avg_session_seconds: number
          engagement_level: string
          engagement_score: number
          has_any_action: boolean
          last_session_duration_seconds: number
          services_created_30d: number
          used_agenda: boolean
          used_finance: boolean
          used_weather_art: boolean
          user_id: string
        }[]
      }
      get_user_organization_id: { Args: never; Returns: string }
      get_webchat_config: {
        Args: { _org_id: string }
        Returns: {
          auto_show_welcome: boolean
          avatar_url: string
          bottom_distance: number
          button_text: string
          color: string
          config_id: string
          display_name: string
          is_active: boolean
          org_id: string
          pos: string
          welcome_message: string
        }[]
      }
      get_whatsapp_report_stats: {
        Args: {
          _channel_id?: string
          _date_from?: string
          _date_to?: string
          _org_id: string
        }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_coupon_usage: {
        Args: { coupon_code_param: string }
        Returns: undefined
      }
      is_employee: { Args: { _user_id: string }; Returns: boolean }
      is_org_admin_or_owner: { Args: { _user_id: string }; Returns: boolean }
      is_root_super_admin: { Args: { _user_id: string }; Returns: boolean }
      is_same_organization: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      normalize_phone_digits: { Args: { raw: string }; Returns: string }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      sign_service_signature: {
        Args: {
          p_ip_address?: string
          p_signature_url: string
          p_signer_name: string
          p_token: string
        }
        Returns: boolean
      }
      switch_organization: { Args: { _org_id: string }; Returns: undefined }
      transfer_between_accounts: {
        Args: {
          _amount: number
          _from_account_id: string
          _notes?: string
          _organization_id: string
          _to_account_id: string
        }
        Returns: undefined
      }
      validate_org_access: { Args: { _org_id: string }; Returns: undefined }
    }
    Enums: {
      app_role: "owner" | "admin" | "member" | "employee" | "super_admin"
      service_status: "scheduled" | "in_progress" | "completed" | "cancelled"
      service_type:
        | "installation"
        | "maintenance"
        | "cleaning"
        | "repair"
        | "maintenance_contract"
        | "pmoc"
        | "visit"
        | "quote"
        | "other"
        | "uninstallation"
      time_clock_entry_type:
        | "clock_in"
        | "break_start"
        | "break_end"
        | "clock_out"
      transaction_category:
        | "service"
        | "product"
        | "other_income"
        | "material"
        | "labor"
        | "fuel"
        | "maintenance"
        | "rent"
        | "utilities"
        | "marketing"
        | "other_expense"
      transaction_type: "income" | "expense"
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
      app_role: ["owner", "admin", "member", "employee", "super_admin"],
      service_status: ["scheduled", "in_progress", "completed", "cancelled"],
      service_type: [
        "installation",
        "maintenance",
        "cleaning",
        "repair",
        "maintenance_contract",
        "pmoc",
        "visit",
        "quote",
        "other",
        "uninstallation",
      ],
      time_clock_entry_type: [
        "clock_in",
        "break_start",
        "break_end",
        "clock_out",
      ],
      transaction_category: [
        "service",
        "product",
        "other_income",
        "material",
        "labor",
        "fuel",
        "maintenance",
        "rent",
        "utilities",
        "marketing",
        "other_expense",
      ],
      transaction_type: ["income", "expense"],
    },
  },
} as const
