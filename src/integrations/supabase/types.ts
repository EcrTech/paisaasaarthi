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
      activity_participants: {
        Row: {
          activity_id: string
          contact_id: string | null
          created_at: string | null
          email: string
          id: string
          name: string
          org_id: string
          response_status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          activity_id: string
          contact_id?: string | null
          created_at?: string | null
          email: string
          id?: string
          name: string
          org_id: string
          response_status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          activity_id?: string
          contact_id?: string | null
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          org_id?: string
          response_status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_participants_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "contact_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_participants_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_participants_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_with_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_participants_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_call_sessions: {
        Row: {
          agent_id: string
          contact_id: string | null
          ended_at: string | null
          exotel_call_sid: string | null
          id: string
          org_id: string
          started_at: string | null
          status: string
        }
        Insert: {
          agent_id: string
          contact_id?: string | null
          ended_at?: string | null
          exotel_call_sid?: string | null
          id?: string
          org_id: string
          started_at?: string | null
          status?: string
        }
        Update: {
          agent_id?: string
          contact_id?: string | null
          ended_at?: string | null
          exotel_call_sid?: string | null
          id?: string
          org_id?: string
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_call_sessions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_call_sessions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_with_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_call_sessions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_rules: {
        Row: {
          approval_type_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          org_id: string
          required_roles: string[]
          threshold_amount: number | null
          updated_at: string
        }
        Insert: {
          approval_type_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          org_id: string
          required_roles?: string[]
          threshold_amount?: number | null
          updated_at?: string
        }
        Update: {
          approval_type_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
          required_roles?: string[]
          threshold_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_rules_approval_type_id_fkey"
            columns: ["approval_type_id"]
            isOneToOne: false
            referencedRelation: "approval_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_types: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_types_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_ab_tests: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          org_id: string
          rule_id: string
          start_date: string
          status: string
          test_name: string
          updated_at: string
          variants: Json
          winner_variant: string | null
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          org_id: string
          rule_id: string
          start_date?: string
          status?: string
          test_name: string
          updated_at?: string
          variants: Json
          winner_variant?: string | null
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          org_id?: string
          rule_id?: string
          start_date?: string
          status?: string
          test_name?: string
          updated_at?: string
          variants?: Json
          winner_variant?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_ab_tests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_ab_tests_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "email_automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_approvals: {
        Row: {
          approval_notes: string | null
          execution_id: string
          expires_at: string | null
          id: string
          org_id: string
          rejection_reason: string | null
          requested_at: string
          requested_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          rule_id: string
          status: string
        }
        Insert: {
          approval_notes?: string | null
          execution_id: string
          expires_at?: string | null
          id?: string
          org_id: string
          rejection_reason?: string | null
          requested_at?: string
          requested_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          rule_id: string
          status?: string
        }
        Update: {
          approval_notes?: string | null
          execution_id?: string
          expires_at?: string | null
          id?: string
          org_id?: string
          rejection_reason?: string | null
          requested_at?: string
          requested_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          rule_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_approvals_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: true
            referencedRelation: "email_automation_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_approvals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_approvals_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "email_automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_performance_daily: {
        Row: {
          avg_time_to_click_minutes: number | null
          avg_time_to_convert_minutes: number | null
          avg_time_to_open_minutes: number | null
          created_at: string
          id: string
          org_id: string
          report_date: string
          rule_id: string | null
          total_clicked: number | null
          total_conversion_value: number | null
          total_converted: number | null
          total_failed: number | null
          total_opened: number | null
          total_sent: number | null
          total_triggered: number | null
          unique_clicks: number | null
          unique_opens: number | null
        }
        Insert: {
          avg_time_to_click_minutes?: number | null
          avg_time_to_convert_minutes?: number | null
          avg_time_to_open_minutes?: number | null
          created_at?: string
          id?: string
          org_id: string
          report_date: string
          rule_id?: string | null
          total_clicked?: number | null
          total_conversion_value?: number | null
          total_converted?: number | null
          total_failed?: number | null
          total_opened?: number | null
          total_sent?: number | null
          total_triggered?: number | null
          unique_clicks?: number | null
          unique_opens?: number | null
        }
        Update: {
          avg_time_to_click_minutes?: number | null
          avg_time_to_convert_minutes?: number | null
          avg_time_to_open_minutes?: number | null
          created_at?: string
          id?: string
          org_id?: string
          report_date?: string
          rule_id?: string | null
          total_clicked?: number | null
          total_conversion_value?: number | null
          total_converted?: number | null
          total_failed?: number | null
          total_opened?: number | null
          total_sent?: number | null
          total_triggered?: number | null
          unique_clicks?: number | null
          unique_opens?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_performance_daily_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_performance_daily_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "email_automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          blog_excerpt: string | null
          blog_title: string
          blog_url: string
          campaign_id: string | null
          created_at: string
          email_campaign_sent: boolean
          email_recipients_count: number | null
          error_message: string | null
          facebook_url: string | null
          featured_image_url: string | null
          id: string
          linkedin_url: string | null
          org_id: string
          posted_timestamp: string
          publish_date: string
          social_posted: boolean
          status: string
          twitter_url: string | null
          updated_at: string
        }
        Insert: {
          blog_excerpt?: string | null
          blog_title: string
          blog_url: string
          campaign_id?: string | null
          created_at?: string
          email_campaign_sent?: boolean
          email_recipients_count?: number | null
          error_message?: string | null
          facebook_url?: string | null
          featured_image_url?: string | null
          id?: string
          linkedin_url?: string | null
          org_id: string
          posted_timestamp?: string
          publish_date: string
          social_posted?: boolean
          status?: string
          twitter_url?: string | null
          updated_at?: string
        }
        Update: {
          blog_excerpt?: string | null
          blog_title?: string
          blog_url?: string
          campaign_id?: string | null
          created_at?: string
          email_campaign_sent?: boolean
          email_recipients_count?: number | null
          error_message?: string | null
          facebook_url?: string | null
          featured_image_url?: string | null
          id?: string
          linkedin_url?: string | null
          org_id?: string
          posted_timestamp?: string
          publish_date?: string
          social_posted?: boolean
          status?: string
          twitter_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      call_dispositions: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          org_id: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          org_id: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          org_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_dispositions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      call_logs: {
        Row: {
          activity_id: string | null
          agent_id: string | null
          answered_at: string | null
          applicant_id: string | null
          call_duration: number | null
          call_type: string
          contact_id: string | null
          conversation_duration: number | null
          created_at: string | null
          direction: string
          disposition_id: string | null
          ended_at: string | null
          exotel_call_sid: string
          exotel_conversation_uuid: string | null
          exotel_raw_data: Json | null
          from_number: string
          id: string
          loan_application_id: string | null
          notes: string | null
          org_id: string
          recording_duration: number | null
          recording_url: string | null
          ring_duration: number | null
          started_at: string | null
          status: string
          sub_disposition_id: string | null
          to_number: string
        }
        Insert: {
          activity_id?: string | null
          agent_id?: string | null
          answered_at?: string | null
          applicant_id?: string | null
          call_duration?: number | null
          call_type: string
          contact_id?: string | null
          conversation_duration?: number | null
          created_at?: string | null
          direction: string
          disposition_id?: string | null
          ended_at?: string | null
          exotel_call_sid: string
          exotel_conversation_uuid?: string | null
          exotel_raw_data?: Json | null
          from_number: string
          id?: string
          loan_application_id?: string | null
          notes?: string | null
          org_id: string
          recording_duration?: number | null
          recording_url?: string | null
          ring_duration?: number | null
          started_at?: string | null
          status: string
          sub_disposition_id?: string | null
          to_number: string
        }
        Update: {
          activity_id?: string | null
          agent_id?: string | null
          answered_at?: string | null
          applicant_id?: string | null
          call_duration?: number | null
          call_type?: string
          contact_id?: string | null
          conversation_duration?: number | null
          created_at?: string | null
          direction?: string
          disposition_id?: string | null
          ended_at?: string | null
          exotel_call_sid?: string
          exotel_conversation_uuid?: string | null
          exotel_raw_data?: Json | null
          from_number?: string
          id?: string
          loan_application_id?: string | null
          notes?: string | null
          org_id?: string
          recording_duration?: number | null
          recording_url?: string | null
          ring_duration?: number | null
          started_at?: string | null
          status?: string
          sub_disposition_id?: string | null
          to_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "contact_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "loan_applicants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_with_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_disposition_id_fkey"
            columns: ["disposition_id"]
            isOneToOne: false
            referencedRelation: "call_dispositions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_loan_application_id_fkey"
            columns: ["loan_application_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_sub_disposition_id_fkey"
            columns: ["sub_disposition_id"]
            isOneToOne: false
            referencedRelation: "call_sub_dispositions"
            referencedColumns: ["id"]
          },
        ]
      }
      call_sub_dispositions: {
        Row: {
          created_at: string | null
          description: string | null
          disposition_id: string
          id: string
          is_active: boolean | null
          name: string
          org_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          disposition_id: string
          id?: string
          is_active?: boolean | null
          name: string
          org_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          disposition_id?: string
          id?: string
          is_active?: boolean | null
          name?: string
          org_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_sub_dispositions_disposition_id_fkey"
            columns: ["disposition_id"]
            isOneToOne: false
            referencedRelation: "call_dispositions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_sub_dispositions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_analytics: {
        Row: {
          bounce_count: number | null
          campaign_id: string
          campaign_type: string
          click_count: number | null
          conversions: number | null
          cpa: number | null
          created_at: string | null
          date: string
          id: string
          open_count: number | null
          org_id: string
          revenue: number | null
          roas: number | null
          spend: number | null
        }
        Insert: {
          bounce_count?: number | null
          campaign_id: string
          campaign_type: string
          click_count?: number | null
          conversions?: number | null
          cpa?: number | null
          created_at?: string | null
          date: string
          id?: string
          open_count?: number | null
          org_id: string
          revenue?: number | null
          roas?: number | null
          spend?: number | null
        }
        Update: {
          bounce_count?: number | null
          campaign_id?: string
          campaign_type?: string
          click_count?: number | null
          conversions?: number | null
          cpa?: number | null
          created_at?: string | null
          date?: string
          id?: string
          open_count?: number | null
          org_id?: string
          revenue?: number | null
          roas?: number | null
          spend?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_analytics_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_insights: {
        Row: {
          analysis: string | null
          campaign_id: string | null
          created_at: string | null
          description: string | null
          expires_at: string | null
          id: string
          impact: string | null
          insight_type: string
          org_id: string
          priority: string
          status: string | null
          suggested_action: string | null
          supporting_data: Json | null
          title: string
          updated_at: string | null
        }
        Insert: {
          analysis?: string | null
          campaign_id?: string | null
          created_at?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          impact?: string | null
          insight_type: string
          org_id: string
          priority: string
          status?: string | null
          suggested_action?: string | null
          supporting_data?: Json | null
          title: string
          updated_at?: string | null
        }
        Update: {
          analysis?: string | null
          campaign_id?: string | null
          created_at?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          impact?: string | null
          insight_type?: string
          org_id?: string
          priority?: string
          status?: string | null
          suggested_action?: string | null
          supporting_data?: Json | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_insights_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_templates: {
        Row: {
          approved_at: string | null
          buttons: Json | null
          category: string | null
          content: string
          created_at: string | null
          footer_text: string | null
          header_content: string | null
          header_type: string | null
          id: string
          language: string | null
          last_synced_at: string | null
          org_id: string
          rejection_reason: string | null
          sample_values: Json | null
          status: string | null
          submission_status: string | null
          submitted_at: string | null
          template_id: string
          template_name: string
          template_type: string
          updated_at: string | null
          variables: Json | null
        }
        Insert: {
          approved_at?: string | null
          buttons?: Json | null
          category?: string | null
          content: string
          created_at?: string | null
          footer_text?: string | null
          header_content?: string | null
          header_type?: string | null
          id?: string
          language?: string | null
          last_synced_at?: string | null
          org_id: string
          rejection_reason?: string | null
          sample_values?: Json | null
          status?: string | null
          submission_status?: string | null
          submitted_at?: string | null
          template_id: string
          template_name: string
          template_type: string
          updated_at?: string | null
          variables?: Json | null
        }
        Update: {
          approved_at?: string | null
          buttons?: Json | null
          category?: string | null
          content?: string
          created_at?: string | null
          footer_text?: string | null
          header_content?: string | null
          header_type?: string | null
          id?: string
          language?: string | null
          last_synced_at?: string | null
          org_id?: string
          rejection_reason?: string | null
          sample_values?: Json | null
          status?: string | null
          submission_status?: string | null
          submitted_at?: string | null
          template_id?: string
          template_name?: string
          template_type?: string
          updated_at?: string | null
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      connector_logs: {
        Row: {
          contact_id: string | null
          created_at: string | null
          error_message: string | null
          form_id: string | null
          http_status_code: number
          id: string
          ip_address: unknown
          org_id: string
          request_id: string
          request_payload: Json
          response_payload: Json | null
          status: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string | null
          error_message?: string | null
          form_id?: string | null
          http_status_code: number
          id?: string
          ip_address?: unknown
          org_id: string
          request_id: string
          request_payload?: Json
          response_payload?: Json | null
          status: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string | null
          error_message?: string | null
          form_id?: string | null
          http_status_code?: number
          id?: string
          ip_address?: unknown
          org_id?: string
          request_id?: string
          request_payload?: Json
          response_payload?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "connector_logs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connector_logs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_with_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connector_logs_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connector_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_activities: {
        Row: {
          activity_type: string
          call_disposition_id: string | null
          call_duration: number | null
          call_sub_disposition_id: string | null
          check_in_latitude: number | null
          check_in_longitude: number | null
          check_out_latitude: number | null
          check_out_longitude: number | null
          completed_at: string | null
          contact_id: string
          created_at: string | null
          created_by: string | null
          description: string | null
          duration_minutes: number | null
          google_calendar_event_id: string | null
          id: string
          location_accuracy: number | null
          meeting_duration_minutes: number | null
          meeting_link: string | null
          meeting_platform: string | null
          morning_reminder_sent: boolean | null
          next_action_date: string | null
          next_action_notes: string | null
          org_id: string
          pre_action_reminder_sent: boolean | null
          reminder_sent: boolean | null
          scheduled_at: string | null
          subject: string | null
          updated_at: string | null
        }
        Insert: {
          activity_type: string
          call_disposition_id?: string | null
          call_duration?: number | null
          call_sub_disposition_id?: string | null
          check_in_latitude?: number | null
          check_in_longitude?: number | null
          check_out_latitude?: number | null
          check_out_longitude?: number | null
          completed_at?: string | null
          contact_id: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          google_calendar_event_id?: string | null
          id?: string
          location_accuracy?: number | null
          meeting_duration_minutes?: number | null
          meeting_link?: string | null
          meeting_platform?: string | null
          morning_reminder_sent?: boolean | null
          next_action_date?: string | null
          next_action_notes?: string | null
          org_id: string
          pre_action_reminder_sent?: boolean | null
          reminder_sent?: boolean | null
          scheduled_at?: string | null
          subject?: string | null
          updated_at?: string | null
        }
        Update: {
          activity_type?: string
          call_disposition_id?: string | null
          call_duration?: number | null
          call_sub_disposition_id?: string | null
          check_in_latitude?: number | null
          check_in_longitude?: number | null
          check_out_latitude?: number | null
          check_out_longitude?: number | null
          completed_at?: string | null
          contact_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          google_calendar_event_id?: string | null
          id?: string
          location_accuracy?: number | null
          meeting_duration_minutes?: number | null
          meeting_link?: string | null
          meeting_platform?: string | null
          morning_reminder_sent?: boolean | null
          next_action_date?: string | null
          next_action_notes?: string | null
          org_id?: string
          pre_action_reminder_sent?: boolean | null
          reminder_sent?: boolean | null
          scheduled_at?: string | null
          subject?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_activities_call_disposition_id_fkey"
            columns: ["call_disposition_id"]
            isOneToOne: false
            referencedRelation: "call_dispositions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_activities_call_sub_disposition_id_fkey"
            columns: ["call_sub_disposition_id"]
            isOneToOne: false
            referencedRelation: "call_sub_dispositions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_with_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_activities_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_custom_fields: {
        Row: {
          contact_id: string
          created_at: string
          custom_field_id: string
          field_value: string | null
          id: string
          updated_at: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          custom_field_id: string
          field_value?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          custom_field_id?: string
          field_value?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_custom_fields_custom_field_id_fkey"
            columns: ["custom_field_id"]
            isOneToOne: false
            referencedRelation: "custom_fields"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_emails: {
        Row: {
          contact_id: string
          created_at: string
          email: string
          email_type: string
          id: string
          is_primary: boolean
          org_id: string
          updated_at: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          email: string
          email_type?: string
          id?: string
          is_primary?: boolean
          org_id: string
          updated_at?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          email?: string
          email_type?: string
          id?: string
          is_primary?: boolean
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_emails_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_emails_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_with_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_enrichment_runs: {
        Row: {
          completed_at: string | null
          contacts_enriched: number | null
          contacts_failed: number | null
          contacts_processed: number | null
          created_at: string
          credits_used: number | null
          error_message: string | null
          id: string
          org_id: string | null
          started_at: string
          status: string | null
        }
        Insert: {
          completed_at?: string | null
          contacts_enriched?: number | null
          contacts_failed?: number | null
          contacts_processed?: number | null
          created_at?: string
          credits_used?: number | null
          error_message?: string | null
          id?: string
          org_id?: string | null
          started_at?: string
          status?: string | null
        }
        Update: {
          completed_at?: string | null
          contacts_enriched?: number | null
          contacts_failed?: number | null
          contacts_processed?: number | null
          created_at?: string
          credits_used?: number | null
          error_message?: string | null
          id?: string
          org_id?: string | null
          started_at?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_enrichment_runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_lead_scores: {
        Row: {
          contact_id: string
          id: string
          last_calculated: string
          org_id: string
          score: number
          score_breakdown: Json | null
          score_category: string | null
        }
        Insert: {
          contact_id: string
          id?: string
          last_calculated?: string
          org_id: string
          score?: number
          score_breakdown?: Json | null
          score_category?: string | null
        }
        Update: {
          contact_id?: string
          id?: string
          last_calculated?: string
          org_id?: string
          score?: number
          score_breakdown?: Json | null
          score_category?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_lead_scores_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: true
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_lead_scores_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: true
            referencedRelation: "contacts_with_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_lead_scores_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_phones: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          is_primary: boolean
          org_id: string
          phone: string
          phone_type: string
          updated_at: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          org_id: string
          phone: string
          phone_type?: string
          updated_at?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          org_id?: string
          phone?: string
          phone_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_phones_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_phones_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_with_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_tag_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          contact_id: string
          id: string
          org_id: string
          tag_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          contact_id: string
          id?: string
          org_id: string
          tag_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          contact_id?: string
          id?: string
          org_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_tag_assignments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_tag_assignments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_with_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_tag_assignments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_tag_assignments_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "contact_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_tags: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          org_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          org_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_tags_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          address: string | null
          apollo_person_id: string | null
          assigned_team_id: string | null
          assigned_to: string | null
          city: string | null
          company: string | null
          country: string | null
          created_at: string | null
          created_by: string | null
          customer_id: string | null
          departments: string[] | null
          education: Json | null
          email: string | null
          email_verified: boolean | null
          email_verified_at: string | null
          employment_history: Json | null
          enrichment_status: string | null
          facebook_url: string | null
          first_name: string
          github_url: string | null
          headline: string | null
          id: string
          job_title: string | null
          last_enriched_at: string | null
          last_name: string | null
          last_verified_location_at: string | null
          latitude: number | null
          linkedin_url: string | null
          longitude: number | null
          notes: string | null
          org_id: string
          organization_founded_year: number | null
          organization_industry: string | null
          organization_keywords: string[] | null
          organization_name: string | null
          person_locations: Json | null
          phone: string
          phone_numbers: Json | null
          phone_verified: boolean | null
          phone_verified_at: string | null
          photo_url: string | null
          pipeline_stage_id: string | null
          postal_code: string | null
          referred_by: string | null
          seniority: string | null
          source: string | null
          state: string | null
          status: string | null
          twitter_url: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          apollo_person_id?: string | null
          assigned_team_id?: string | null
          assigned_to?: string | null
          city?: string | null
          company?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          departments?: string[] | null
          education?: Json | null
          email?: string | null
          email_verified?: boolean | null
          email_verified_at?: string | null
          employment_history?: Json | null
          enrichment_status?: string | null
          facebook_url?: string | null
          first_name: string
          github_url?: string | null
          headline?: string | null
          id?: string
          job_title?: string | null
          last_enriched_at?: string | null
          last_name?: string | null
          last_verified_location_at?: string | null
          latitude?: number | null
          linkedin_url?: string | null
          longitude?: number | null
          notes?: string | null
          org_id: string
          organization_founded_year?: number | null
          organization_industry?: string | null
          organization_keywords?: string[] | null
          organization_name?: string | null
          person_locations?: Json | null
          phone: string
          phone_numbers?: Json | null
          phone_verified?: boolean | null
          phone_verified_at?: string | null
          photo_url?: string | null
          pipeline_stage_id?: string | null
          postal_code?: string | null
          referred_by?: string | null
          seniority?: string | null
          source?: string | null
          state?: string | null
          status?: string | null
          twitter_url?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          apollo_person_id?: string | null
          assigned_team_id?: string | null
          assigned_to?: string | null
          city?: string | null
          company?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          departments?: string[] | null
          education?: Json | null
          email?: string | null
          email_verified?: boolean | null
          email_verified_at?: string | null
          employment_history?: Json | null
          enrichment_status?: string | null
          facebook_url?: string | null
          first_name?: string
          github_url?: string | null
          headline?: string | null
          id?: string
          job_title?: string | null
          last_enriched_at?: string | null
          last_name?: string | null
          last_verified_location_at?: string | null
          latitude?: number | null
          linkedin_url?: string | null
          longitude?: number | null
          notes?: string | null
          org_id?: string
          organization_founded_year?: number | null
          organization_industry?: string | null
          organization_keywords?: string[] | null
          organization_name?: string | null
          person_locations?: Json | null
          phone?: string
          phone_numbers?: Json | null
          phone_verified?: boolean | null
          phone_verified_at?: string | null
          photo_url?: string | null
          pipeline_stage_id?: string | null
          postal_code?: string | null
          referred_by?: string | null
          seniority?: string | null
          source?: string | null
          state?: string | null
          status?: string | null
          twitter_url?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_assigned_team_id_fkey"
            columns: ["assigned_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_pipeline_stage_id_fkey"
            columns: ["pipeline_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_fields: {
        Row: {
          applies_to_table: string
          created_at: string
          field_label: string
          field_name: string
          field_options: Json | null
          field_order: number
          field_type: string
          id: string
          is_active: boolean | null
          is_required: boolean | null
          org_id: string
          updated_at: string
        }
        Insert: {
          applies_to_table: string
          created_at?: string
          field_label: string
          field_name: string
          field_options?: Json | null
          field_order?: number
          field_type: string
          id?: string
          is_active?: boolean | null
          is_required?: boolean | null
          org_id: string
          updated_at?: string
        }
        Update: {
          applies_to_table?: string
          created_at?: string
          field_label?: string
          field_name?: string
          field_options?: Json | null
          field_order?: number
          field_type?: string
          id?: string
          is_active?: boolean | null
          is_required?: boolean | null
          org_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      designation_feature_access: {
        Row: {
          can_create: boolean | null
          can_delete: boolean | null
          can_edit: boolean | null
          can_view: boolean | null
          created_at: string | null
          custom_permissions: Json | null
          designation_id: string
          feature_key: string
          id: string
          org_id: string
          updated_at: string | null
        }
        Insert: {
          can_create?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          custom_permissions?: Json | null
          designation_id: string
          feature_key: string
          id?: string
          org_id: string
          updated_at?: string | null
        }
        Update: {
          can_create?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          custom_permissions?: Json | null
          designation_id?: string
          feature_key?: string
          id?: string
          org_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "designation_feature_access_designation_id_fkey"
            columns: ["designation_id"]
            isOneToOne: false
            referencedRelation: "designations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "designation_feature_access_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      designations: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          org_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
        }
        Relationships: []
      }
      document_esign_requests: {
        Row: {
          aadhaar_request_id: string | null
          access_token: string
          application_id: string
          audit_log: Json | null
          created_at: string | null
          created_by: string | null
          document_id: string | null
          document_type: string
          esign_response: Json | null
          id: string
          notification_channel: string | null
          notification_sent_at: string | null
          nupay_docket_id: string | null
          nupay_document_id: string | null
          nupay_ref_no: string | null
          org_id: string
          signed_at: string | null
          signed_document_path: string | null
          signed_from_ip: string | null
          signer_aadhaar_last4: string | null
          signer_email: string | null
          signer_name: string
          signer_phone: string | null
          signer_sequence: number | null
          signer_url: string | null
          status: string
          token_expires_at: string
          updated_at: string | null
          viewed_at: string | null
        }
        Insert: {
          aadhaar_request_id?: string | null
          access_token: string
          application_id: string
          audit_log?: Json | null
          created_at?: string | null
          created_by?: string | null
          document_id?: string | null
          document_type: string
          esign_response?: Json | null
          id?: string
          notification_channel?: string | null
          notification_sent_at?: string | null
          nupay_docket_id?: string | null
          nupay_document_id?: string | null
          nupay_ref_no?: string | null
          org_id: string
          signed_at?: string | null
          signed_document_path?: string | null
          signed_from_ip?: string | null
          signer_aadhaar_last4?: string | null
          signer_email?: string | null
          signer_name: string
          signer_phone?: string | null
          signer_sequence?: number | null
          signer_url?: string | null
          status?: string
          token_expires_at: string
          updated_at?: string | null
          viewed_at?: string | null
        }
        Update: {
          aadhaar_request_id?: string | null
          access_token?: string
          application_id?: string
          audit_log?: Json | null
          created_at?: string | null
          created_by?: string | null
          document_id?: string | null
          document_type?: string
          esign_response?: Json | null
          id?: string
          notification_channel?: string | null
          notification_sent_at?: string | null
          nupay_docket_id?: string | null
          nupay_document_id?: string | null
          nupay_ref_no?: string | null
          org_id?: string
          signed_at?: string | null
          signed_document_path?: string | null
          signed_from_ip?: string | null
          signer_aadhaar_last4?: string | null
          signer_email?: string | null
          signer_name?: string
          signer_phone?: string | null
          signer_sequence?: number | null
          signer_url?: string | null
          status?: string
          token_expires_at?: string
          updated_at?: string | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_esign_requests_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_esign_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_esign_requests_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "loan_generated_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_esign_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_automation_cooldowns: {
        Row: {
          contact_id: string
          id: string
          last_sent_at: string
          org_id: string
          rule_id: string
          send_count: number | null
        }
        Insert: {
          contact_id: string
          id?: string
          last_sent_at: string
          org_id: string
          rule_id: string
          send_count?: number | null
        }
        Update: {
          contact_id?: string
          id?: string
          last_sent_at?: string
          org_id?: string
          rule_id?: string
          send_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "email_automation_cooldowns_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_automation_cooldowns_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_with_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_automation_cooldowns_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_automation_cooldowns_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "email_automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      email_automation_daily_limits: {
        Row: {
          contact_id: string
          email_count: number
          id: string
          last_sent_at: string
          org_id: string
          send_date: string
        }
        Insert: {
          contact_id: string
          email_count?: number
          id?: string
          last_sent_at?: string
          org_id: string
          send_date?: string
        }
        Update: {
          contact_id?: string
          email_count?: number
          id?: string
          last_sent_at?: string
          org_id?: string
          send_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_automation_daily_limits_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_automation_daily_limits_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_with_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_automation_daily_limits_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_automation_executions: {
        Row: {
          ab_test_id: string | null
          ab_variant_name: string | null
          contact_id: string
          conversion_type: string | null
          conversion_value: number | null
          converted_at: string | null
          created_at: string | null
          email_conversation_id: string | null
          email_subject: string | null
          email_template_id: string | null
          error_message: string | null
          id: string
          max_retries: number | null
          next_retry_at: string | null
          org_id: string
          retry_count: number | null
          rule_id: string
          scheduled_for: string | null
          sent_at: string | null
          status: string
          trigger_data: Json | null
          trigger_type: string
          updated_at: string | null
        }
        Insert: {
          ab_test_id?: string | null
          ab_variant_name?: string | null
          contact_id: string
          conversion_type?: string | null
          conversion_value?: number | null
          converted_at?: string | null
          created_at?: string | null
          email_conversation_id?: string | null
          email_subject?: string | null
          email_template_id?: string | null
          error_message?: string | null
          id?: string
          max_retries?: number | null
          next_retry_at?: string | null
          org_id: string
          retry_count?: number | null
          rule_id: string
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          trigger_data?: Json | null
          trigger_type: string
          updated_at?: string | null
        }
        Update: {
          ab_test_id?: string | null
          ab_variant_name?: string | null
          contact_id?: string
          conversion_type?: string | null
          conversion_value?: number | null
          converted_at?: string | null
          created_at?: string | null
          email_conversation_id?: string | null
          email_subject?: string | null
          email_template_id?: string | null
          error_message?: string | null
          id?: string
          max_retries?: number | null
          next_retry_at?: string | null
          org_id?: string
          retry_count?: number | null
          rule_id?: string
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          trigger_data?: Json | null
          trigger_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_automation_executions_ab_test_id_fkey"
            columns: ["ab_test_id"]
            isOneToOne: false
            referencedRelation: "automation_ab_tests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_automation_executions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_automation_executions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_with_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_automation_executions_email_conversation_id_fkey"
            columns: ["email_conversation_id"]
            isOneToOne: false
            referencedRelation: "email_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_automation_executions_email_template_id_fkey"
            columns: ["email_template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_automation_executions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_automation_executions_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "email_automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      email_automation_rule_dependencies: {
        Row: {
          created_at: string
          delay_minutes: number | null
          dependency_type: string
          depends_on_rule_id: string
          id: string
          org_id: string
          rule_id: string
        }
        Insert: {
          created_at?: string
          delay_minutes?: number | null
          dependency_type: string
          depends_on_rule_id: string
          id?: string
          org_id: string
          rule_id: string
        }
        Update: {
          created_at?: string
          delay_minutes?: number | null
          dependency_type?: string
          depends_on_rule_id?: string
          id?: string
          org_id?: string
          rule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_automation_rule_dependencies_depends_on_rule_id_fkey"
            columns: ["depends_on_rule_id"]
            isOneToOne: false
            referencedRelation: "email_automation_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_automation_rule_dependencies_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_automation_rule_dependencies_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "email_automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      email_automation_rule_templates: {
        Row: {
          category: string
          condition_logic: string | null
          conditions: Json | null
          cooldown_period_days: number | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_popular: boolean | null
          name: string
          priority: number | null
          send_delay_minutes: number | null
          trigger_config: Json
          trigger_type: string
          updated_at: string
          use_count: number | null
        }
        Insert: {
          category: string
          condition_logic?: string | null
          conditions?: Json | null
          cooldown_period_days?: number | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_popular?: boolean | null
          name: string
          priority?: number | null
          send_delay_minutes?: number | null
          trigger_config?: Json
          trigger_type: string
          updated_at?: string
          use_count?: number | null
        }
        Update: {
          category?: string
          condition_logic?: string | null
          conditions?: Json | null
          cooldown_period_days?: number | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_popular?: boolean | null
          name?: string
          priority?: number | null
          send_delay_minutes?: number | null
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
          use_count?: number | null
        }
        Relationships: []
      }
      email_automation_rules: {
        Row: {
          ab_test_enabled: boolean
          approval_timeout_hours: number | null
          condition_logic: string | null
          conditions: Json | null
          cooldown_period_days: number | null
          created_at: string | null
          created_by: string | null
          description: string | null
          email_template_id: string | null
          enforce_business_hours: boolean
          id: string
          is_active: boolean | null
          max_sends_per_contact: number | null
          name: string
          org_id: string
          priority: number | null
          requires_approval: boolean | null
          send_at_specific_time: string | null
          send_delay_minutes: number | null
          send_on_business_days_only: boolean | null
          total_failed: number | null
          total_sent: number | null
          total_triggered: number | null
          trigger_config: Json
          trigger_type: string
          updated_at: string | null
        }
        Insert: {
          ab_test_enabled?: boolean
          approval_timeout_hours?: number | null
          condition_logic?: string | null
          conditions?: Json | null
          cooldown_period_days?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          email_template_id?: string | null
          enforce_business_hours?: boolean
          id?: string
          is_active?: boolean | null
          max_sends_per_contact?: number | null
          name: string
          org_id: string
          priority?: number | null
          requires_approval?: boolean | null
          send_at_specific_time?: string | null
          send_delay_minutes?: number | null
          send_on_business_days_only?: boolean | null
          total_failed?: number | null
          total_sent?: number | null
          total_triggered?: number | null
          trigger_config?: Json
          trigger_type: string
          updated_at?: string | null
        }
        Update: {
          ab_test_enabled?: boolean
          approval_timeout_hours?: number | null
          condition_logic?: string | null
          conditions?: Json | null
          cooldown_period_days?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          email_template_id?: string | null
          enforce_business_hours?: boolean
          id?: string
          is_active?: boolean | null
          max_sends_per_contact?: number | null
          name?: string
          org_id?: string
          priority?: number | null
          requires_approval?: boolean | null
          send_at_specific_time?: string | null
          send_delay_minutes?: number | null
          send_on_business_days_only?: boolean | null
          total_failed?: number | null
          total_sent?: number | null
          total_triggered?: number | null
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_automation_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_automation_rules_email_template_id_fkey"
            columns: ["email_template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_automation_rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_bulk_campaigns: {
        Row: {
          attachments: Json | null
          body_content: string | null
          buttons: Json | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          failed_count: number
          html_content: string
          id: string
          name: string
          org_id: string
          pending_count: number
          scheduled_at: string | null
          sent_count: number
          started_at: string | null
          status: string
          subject: string
          template_id: string | null
          total_recipients: number
          updated_at: string
          variable_mappings: Json | null
        }
        Insert: {
          attachments?: Json | null
          body_content?: string | null
          buttons?: Json | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          failed_count?: number
          html_content: string
          id?: string
          name: string
          org_id: string
          pending_count?: number
          scheduled_at?: string | null
          sent_count?: number
          started_at?: string | null
          status?: string
          subject: string
          template_id?: string | null
          total_recipients?: number
          updated_at?: string
          variable_mappings?: Json | null
        }
        Update: {
          attachments?: Json | null
          body_content?: string | null
          buttons?: Json | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          failed_count?: number
          html_content?: string
          id?: string
          name?: string
          org_id?: string
          pending_count?: number
          scheduled_at?: string | null
          sent_count?: number
          started_at?: string | null
          status?: string
          subject?: string
          template_id?: string | null
          total_recipients?: number
          updated_at?: string
          variable_mappings?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "email_bulk_campaigns_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_bulk_campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaign_recipients: {
        Row: {
          bounce_reason: string | null
          bounced_at: string | null
          button_clicks: Json | null
          campaign_id: string
          click_count: number | null
          complained_at: string | null
          contact_id: string | null
          created_at: string
          custom_data: Json | null
          delivered_at: string | null
          email: string
          error_message: string | null
          first_clicked_at: string | null
          id: string
          open_count: number | null
          opened_at: string | null
          resend_email_id: string | null
          sent_at: string | null
          status: string
          tracking_pixel_id: string | null
          updated_at: string
        }
        Insert: {
          bounce_reason?: string | null
          bounced_at?: string | null
          button_clicks?: Json | null
          campaign_id: string
          click_count?: number | null
          complained_at?: string | null
          contact_id?: string | null
          created_at?: string
          custom_data?: Json | null
          delivered_at?: string | null
          email: string
          error_message?: string | null
          first_clicked_at?: string | null
          id?: string
          open_count?: number | null
          opened_at?: string | null
          resend_email_id?: string | null
          sent_at?: string | null
          status?: string
          tracking_pixel_id?: string | null
          updated_at?: string
        }
        Update: {
          bounce_reason?: string | null
          bounced_at?: string | null
          button_clicks?: Json | null
          campaign_id?: string
          click_count?: number | null
          complained_at?: string | null
          contact_id?: string | null
          created_at?: string
          custom_data?: Json | null
          delivered_at?: string | null
          email?: string
          error_message?: string | null
          first_clicked_at?: string | null
          id?: string
          open_count?: number | null
          opened_at?: string | null
          resend_email_id?: string | null
          sent_at?: string | null
          status?: string
          tracking_pixel_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_bulk_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaign_recipients_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaign_recipients_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_with_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      email_conversations: {
        Row: {
          attachments: Json | null
          bcc_emails: string[] | null
          button_clicks: Json | null
          cc_emails: string[] | null
          click_count: number
          contact_id: string | null
          conversation_id: string
          created_at: string | null
          direction: string
          email_content: string
          first_clicked_at: string | null
          from_email: string
          from_name: string | null
          has_attachments: boolean | null
          html_content: string | null
          id: string
          is_read: boolean | null
          open_count: number
          opened_at: string | null
          org_id: string
          provider_message_id: string | null
          read_at: string | null
          received_at: string | null
          replied_to_message_id: string | null
          reply_to_email: string | null
          scheduled_at: string | null
          sent_at: string | null
          sent_by: string | null
          status: string | null
          subject: string
          thread_id: string | null
          to_email: string
          tracking_pixel_id: string | null
          unsubscribe_token: string | null
          updated_at: string | null
        }
        Insert: {
          attachments?: Json | null
          bcc_emails?: string[] | null
          button_clicks?: Json | null
          cc_emails?: string[] | null
          click_count?: number
          contact_id?: string | null
          conversation_id: string
          created_at?: string | null
          direction: string
          email_content: string
          first_clicked_at?: string | null
          from_email: string
          from_name?: string | null
          has_attachments?: boolean | null
          html_content?: string | null
          id?: string
          is_read?: boolean | null
          open_count?: number
          opened_at?: string | null
          org_id: string
          provider_message_id?: string | null
          read_at?: string | null
          received_at?: string | null
          replied_to_message_id?: string | null
          reply_to_email?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string | null
          subject: string
          thread_id?: string | null
          to_email: string
          tracking_pixel_id?: string | null
          unsubscribe_token?: string | null
          updated_at?: string | null
        }
        Update: {
          attachments?: Json | null
          bcc_emails?: string[] | null
          button_clicks?: Json | null
          cc_emails?: string[] | null
          click_count?: number
          contact_id?: string | null
          conversation_id?: string
          created_at?: string | null
          direction?: string
          email_content?: string
          first_clicked_at?: string | null
          from_email?: string
          from_name?: string | null
          has_attachments?: boolean | null
          html_content?: string | null
          id?: string
          is_read?: boolean | null
          open_count?: number
          opened_at?: string | null
          org_id?: string
          provider_message_id?: string | null
          read_at?: string | null
          received_at?: string | null
          replied_to_message_id?: string | null
          reply_to_email?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string | null
          subject?: string
          thread_id?: string | null
          to_email?: string
          tracking_pixel_id?: string | null
          unsubscribe_token?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_with_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_conversations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_conversations_replied_to_message_id_fkey"
            columns: ["replied_to_message_id"]
            isOneToOne: false
            referencedRelation: "email_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_engagement_patterns: {
        Row: {
          click_count: number | null
          contact_id: string | null
          day_of_week: number
          engagement_score: number | null
          hour_of_day: number
          id: string
          last_updated: string
          open_count: number | null
          org_id: string
        }
        Insert: {
          click_count?: number | null
          contact_id?: string | null
          day_of_week: number
          engagement_score?: number | null
          hour_of_day: number
          id?: string
          last_updated?: string
          open_count?: number | null
          org_id: string
        }
        Update: {
          click_count?: number | null
          contact_id?: string | null
          day_of_week?: number
          engagement_score?: number | null
          hour_of_day?: number
          id?: string
          last_updated?: string
          open_count?: number | null
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_engagement_patterns_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_engagement_patterns_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_with_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_engagement_patterns_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_settings: {
        Row: {
          created_at: string | null
          dns_records: Json | null
          id: string
          inbound_route_id: string | null
          inbound_routing_enabled: boolean | null
          inbound_webhook_url: string | null
          is_active: boolean | null
          org_id: string
          resend_domain_id: string | null
          sending_domain: string
          updated_at: string | null
          verification_status: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string | null
          dns_records?: Json | null
          id?: string
          inbound_route_id?: string | null
          inbound_routing_enabled?: boolean | null
          inbound_webhook_url?: string | null
          is_active?: boolean | null
          org_id: string
          resend_domain_id?: string | null
          sending_domain: string
          updated_at?: string | null
          verification_status?: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string | null
          dns_records?: Json | null
          id?: string
          inbound_route_id?: string | null
          inbound_routing_enabled?: boolean | null
          inbound_webhook_url?: string | null
          is_active?: boolean | null
          org_id?: string
          resend_domain_id?: string | null
          sending_domain?: string
          updated_at?: string | null
          verification_status?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_suppression_list: {
        Row: {
          created_at: string
          email: string
          id: string
          notes: string | null
          org_id: string
          reason: string
          suppressed_at: string
          suppressed_by: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          notes?: string | null
          org_id: string
          reason: string
          suppressed_at?: string
          suppressed_by?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          notes?: string | null
          org_id?: string
          reason?: string
          suppressed_at?: string
          suppressed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_suppression_list_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          attachments: Json | null
          body_content: string | null
          buttons: Json | null
          created_at: string
          created_by: string | null
          design_json: Json | null
          html_content: string | null
          id: string
          is_active: boolean
          name: string
          org_id: string
          subject: string
          updated_at: string
        }
        Insert: {
          attachments?: Json | null
          body_content?: string | null
          buttons?: Json | null
          created_at?: string
          created_by?: string | null
          design_json?: Json | null
          html_content?: string | null
          id?: string
          is_active?: boolean
          name: string
          org_id: string
          subject: string
          updated_at?: string
        }
        Update: {
          attachments?: Json | null
          body_content?: string | null
          buttons?: Json | null
          created_at?: string
          created_by?: string | null
          design_json?: Json | null
          html_content?: string | null
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_unsubscribes: {
        Row: {
          contact_id: string | null
          email: string
          id: string
          ip_address: unknown
          org_id: string
          source: string
          unsubscribe_token: string
          unsubscribed_at: string
          user_agent: string | null
        }
        Insert: {
          contact_id?: string | null
          email: string
          id?: string
          ip_address?: unknown
          org_id: string
          source: string
          unsubscribe_token: string
          unsubscribed_at?: string
          user_agent?: string | null
        }
        Update: {
          contact_id?: string | null
          email?: string
          id?: string
          ip_address?: unknown
          org_id?: string
          source?: string
          unsubscribe_token?: string
          unsubscribed_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_unsubscribes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_unsubscribes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_with_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_unsubscribes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      error_logs: {
        Row: {
          created_at: string
          error_details: Json | null
          error_message: string
          error_type: string
          id: string
          org_id: string
          page_url: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_details?: Json | null
          error_message: string
          error_type: string
          id?: string
          org_id: string
          page_url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_details?: Json | null
          error_message?: string
          error_type?: string
          id?: string
          org_id?: string
          page_url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "error_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "error_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exotel_settings: {
        Row: {
          account_sid: string
          api_key: string
          api_token: string
          call_recording_enabled: boolean | null
          caller_id: string
          created_at: string | null
          dlt_entity_id: string | null
          id: string
          is_active: boolean | null
          org_id: string
          sms_sender_id: string | null
          subdomain: string
          updated_at: string | null
        }
        Insert: {
          account_sid: string
          api_key: string
          api_token: string
          call_recording_enabled?: boolean | null
          caller_id: string
          created_at?: string | null
          dlt_entity_id?: string | null
          id?: string
          is_active?: boolean | null
          org_id: string
          sms_sender_id?: string | null
          subdomain?: string
          updated_at?: string | null
        }
        Update: {
          account_sid?: string
          api_key?: string
          api_token?: string
          call_recording_enabled?: boolean | null
          caller_id?: string
          created_at?: string | null
          dlt_entity_id?: string | null
          id?: string
          is_active?: boolean | null
          org_id?: string
          sms_sender_id?: string | null
          subdomain?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exotel_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_permissions: {
        Row: {
          category: string
          created_at: string | null
          feature_description: string | null
          feature_key: string
          feature_name: string
          id: string
          is_premium: boolean | null
        }
        Insert: {
          category: string
          created_at?: string | null
          feature_description?: string | null
          feature_key: string
          feature_name: string
          id?: string
          is_premium?: boolean | null
        }
        Update: {
          category?: string
          created_at?: string | null
          feature_description?: string | null
          feature_key?: string
          feature_name?: string
          id?: string
          is_premium?: boolean | null
        }
        Relationships: []
      }
      form_fields: {
        Row: {
          created_at: string | null
          custom_field_id: string
          field_order: number
          form_id: string
          id: string
        }
        Insert: {
          created_at?: string | null
          custom_field_id: string
          field_order?: number
          form_id: string
          id?: string
        }
        Update: {
          created_at?: string | null
          custom_field_id?: string
          field_order?: number
          form_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_fields_custom_field_id_fkey"
            columns: ["custom_field_id"]
            isOneToOne: false
            referencedRelation: "custom_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_fields_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
        Row: {
          connector_type: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          org_id: string
          rate_limit_per_minute: number | null
          updated_at: string | null
          webhook_config: Json | null
          webhook_token: string | null
        }
        Insert: {
          connector_type?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          org_id: string
          rate_limit_per_minute?: number | null
          updated_at?: string | null
          webhook_config?: Json | null
          webhook_token?: string | null
        }
        Update: {
          connector_type?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          org_id?: string
          rate_limit_per_minute?: number | null
          updated_at?: string | null
          webhook_config?: Json | null
          webhook_token?: string | null
        }
        Relationships: []
      }
      google_oauth_tokens: {
        Row: {
          access_token: string | null
          calendar_id: string | null
          created_at: string | null
          id: string
          org_id: string
          refresh_token: string
          token_expires_at: string | null
          updated_at: string | null
          user_email: string | null
        }
        Insert: {
          access_token?: string | null
          calendar_id?: string | null
          created_at?: string | null
          id?: string
          org_id: string
          refresh_token: string
          token_expires_at?: string | null
          updated_at?: string | null
          user_email?: string | null
        }
        Update: {
          access_token?: string | null
          calendar_id?: string | null
          created_at?: string | null
          id?: string
          org_id?: string
          refresh_token?: string
          token_expires_at?: string | null
          updated_at?: string | null
          user_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "google_oauth_tokens_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          current_stage: string | null
          error_count: number | null
          error_details: Json | null
          file_cleaned_up: boolean | null
          file_cleanup_at: string | null
          file_name: string
          file_path: string
          id: string
          import_type: string
          org_id: string
          processed_rows: number | null
          stage_details: Json | null
          started_at: string | null
          status: string
          success_count: number | null
          target_id: string | null
          total_rows: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          current_stage?: string | null
          error_count?: number | null
          error_details?: Json | null
          file_cleaned_up?: boolean | null
          file_cleanup_at?: string | null
          file_name: string
          file_path: string
          id?: string
          import_type: string
          org_id: string
          processed_rows?: number | null
          stage_details?: Json | null
          started_at?: string | null
          status?: string
          success_count?: number | null
          target_id?: string | null
          total_rows?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          current_stage?: string | null
          error_count?: number | null
          error_details?: Json | null
          file_cleaned_up?: boolean | null
          file_cleanup_at?: string | null
          file_name?: string
          file_path?: string
          id?: string
          import_type?: string
          org_id?: string
          processed_rows?: number | null
          stage_details?: Json | null
          started_at?: string | null
          status?: string
          success_count?: number | null
          target_id?: string | null
          total_rows?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          available_qty: number
          batch_no: string | null
          brand: string | null
          category: string | null
          certificate_no: string | null
          created_at: string
          created_by: string | null
          customer_project: string | null
          date_of_entry: string | null
          diameter_mm: string | null
          discount_pct: number | null
          drive_type: string | null
          expiry_review_date: string | null
          finish_coating: string | null
          grade_class: string | null
          gst_pct: number | null
          head_type: string | null
          heat_no: string | null
          hsn_code: string | null
          id: string
          image_ref: string | null
          import_job_id: string | null
          inspection_status: string | null
          issued_to: string | null
          item_id_sku: string
          item_name: string | null
          last_purchase_date: string | null
          last_purchase_price: number | null
          last_sale_date: string | null
          lead_time_days: number | null
          length_mm: string | null
          material: string | null
          org_id: string
          purchase_order_no: string | null
          remarks_notes: string | null
          reorder_level: number | null
          reorder_qty: number | null
          selling_price: number | null
          standard_spec: string | null
          storage_location: string | null
          subcategory: string | null
          supplier_code: string | null
          supplier_name: string | null
          thread_pitch: string | null
          uom: string | null
          updated_at: string
          warehouse_branch: string | null
          weight_per_unit: number | null
        }
        Insert: {
          available_qty?: number
          batch_no?: string | null
          brand?: string | null
          category?: string | null
          certificate_no?: string | null
          created_at?: string
          created_by?: string | null
          customer_project?: string | null
          date_of_entry?: string | null
          diameter_mm?: string | null
          discount_pct?: number | null
          drive_type?: string | null
          expiry_review_date?: string | null
          finish_coating?: string | null
          grade_class?: string | null
          gst_pct?: number | null
          head_type?: string | null
          heat_no?: string | null
          hsn_code?: string | null
          id?: string
          image_ref?: string | null
          import_job_id?: string | null
          inspection_status?: string | null
          issued_to?: string | null
          item_id_sku: string
          item_name?: string | null
          last_purchase_date?: string | null
          last_purchase_price?: number | null
          last_sale_date?: string | null
          lead_time_days?: number | null
          length_mm?: string | null
          material?: string | null
          org_id: string
          purchase_order_no?: string | null
          remarks_notes?: string | null
          reorder_level?: number | null
          reorder_qty?: number | null
          selling_price?: number | null
          standard_spec?: string | null
          storage_location?: string | null
          subcategory?: string | null
          supplier_code?: string | null
          supplier_name?: string | null
          thread_pitch?: string | null
          uom?: string | null
          updated_at?: string
          warehouse_branch?: string | null
          weight_per_unit?: number | null
        }
        Update: {
          available_qty?: number
          batch_no?: string | null
          brand?: string | null
          category?: string | null
          certificate_no?: string | null
          created_at?: string
          created_by?: string | null
          customer_project?: string | null
          date_of_entry?: string | null
          diameter_mm?: string | null
          discount_pct?: number | null
          drive_type?: string | null
          expiry_review_date?: string | null
          finish_coating?: string | null
          grade_class?: string | null
          gst_pct?: number | null
          head_type?: string | null
          heat_no?: string | null
          hsn_code?: string | null
          id?: string
          image_ref?: string | null
          import_job_id?: string | null
          inspection_status?: string | null
          issued_to?: string | null
          item_id_sku?: string
          item_name?: string | null
          last_purchase_date?: string | null
          last_purchase_price?: number | null
          last_sale_date?: string | null
          lead_time_days?: number | null
          length_mm?: string | null
          material?: string | null
          org_id?: string
          purchase_order_no?: string | null
          remarks_notes?: string | null
          reorder_level?: number | null
          reorder_qty?: number | null
          selling_price?: number | null
          standard_spec?: string | null
          storage_location?: string | null
          subcategory?: string | null
          supplier_code?: string | null
          supplier_name?: string | null
          thread_pitch?: string | null
          uom?: string | null
          updated_at?: string
          warehouse_branch?: string | null
          weight_per_unit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_import_job_id_fkey"
            columns: ["import_job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_applicants: {
        Row: {
          aadhaar_number: string | null
          age: number | null
          alternate_mobile: string | null
          applicant_type: string
          bank_account_holder_name: string | null
          bank_account_number: string | null
          bank_account_type: string | null
          bank_branch: string | null
          bank_ifsc_code: string | null
          bank_name: string | null
          bank_verification_method: string | null
          bank_verified: boolean | null
          bank_verified_at: string | null
          created_at: string
          current_address: Json | null
          dob: string
          education_qualification: string | null
          email: string | null
          father_name: string | null
          first_name: string
          gender: string | null
          id: string
          last_name: string | null
          loan_application_id: string
          marital_status: string | null
          middle_name: string | null
          mobile: string
          mother_name: string | null
          office_email: string | null
          office_email_verified: boolean | null
          pan_number: string | null
          permanent_address: Json | null
          personal_ref_address: string | null
          personal_ref_email: string | null
          personal_ref_mobile: string | null
          personal_ref_name: string | null
          professional_ref_address: string | null
          professional_ref_email: string | null
          professional_ref_mobile: string | null
          professional_ref_name: string | null
          religion: string | null
          residence_type: string | null
          updated_at: string
          years_at_current_address: number | null
        }
        Insert: {
          aadhaar_number?: string | null
          age?: number | null
          alternate_mobile?: string | null
          applicant_type?: string
          bank_account_holder_name?: string | null
          bank_account_number?: string | null
          bank_account_type?: string | null
          bank_branch?: string | null
          bank_ifsc_code?: string | null
          bank_name?: string | null
          bank_verification_method?: string | null
          bank_verified?: boolean | null
          bank_verified_at?: string | null
          created_at?: string
          current_address?: Json | null
          dob: string
          education_qualification?: string | null
          email?: string | null
          father_name?: string | null
          first_name: string
          gender?: string | null
          id?: string
          last_name?: string | null
          loan_application_id: string
          marital_status?: string | null
          middle_name?: string | null
          mobile: string
          mother_name?: string | null
          office_email?: string | null
          office_email_verified?: boolean | null
          pan_number?: string | null
          permanent_address?: Json | null
          personal_ref_address?: string | null
          personal_ref_email?: string | null
          personal_ref_mobile?: string | null
          personal_ref_name?: string | null
          professional_ref_address?: string | null
          professional_ref_email?: string | null
          professional_ref_mobile?: string | null
          professional_ref_name?: string | null
          religion?: string | null
          residence_type?: string | null
          updated_at?: string
          years_at_current_address?: number | null
        }
        Update: {
          aadhaar_number?: string | null
          age?: number | null
          alternate_mobile?: string | null
          applicant_type?: string
          bank_account_holder_name?: string | null
          bank_account_number?: string | null
          bank_account_type?: string | null
          bank_branch?: string | null
          bank_ifsc_code?: string | null
          bank_name?: string | null
          bank_verification_method?: string | null
          bank_verified?: boolean | null
          bank_verified_at?: string | null
          created_at?: string
          current_address?: Json | null
          dob?: string
          education_qualification?: string | null
          email?: string | null
          father_name?: string | null
          first_name?: string
          gender?: string | null
          id?: string
          last_name?: string | null
          loan_application_id?: string
          marital_status?: string | null
          middle_name?: string | null
          mobile?: string
          mother_name?: string | null
          office_email?: string | null
          office_email_verified?: boolean | null
          pan_number?: string | null
          permanent_address?: Json | null
          personal_ref_address?: string | null
          personal_ref_email?: string | null
          personal_ref_mobile?: string | null
          personal_ref_name?: string | null
          professional_ref_address?: string | null
          professional_ref_email?: string | null
          professional_ref_mobile?: string | null
          professional_ref_name?: string | null
          religion?: string | null
          residence_type?: string | null
          updated_at?: string
          years_at_current_address?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_applicants_loan_application_id_fkey"
            columns: ["loan_application_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_application_forms: {
        Row: {
          created_at: string | null
          description: string | null
          form_settings: Json | null
          id: string
          is_active: boolean | null
          name: string
          org_id: string
          product_type: string
          required_documents: Json | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          form_settings?: Json | null
          id?: string
          is_active?: boolean | null
          name: string
          org_id: string
          product_type?: string
          required_documents?: Json | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          form_settings?: Json | null
          id?: string
          is_active?: boolean | null
          name?: string
          org_id?: string
          product_type?: string
          required_documents?: Json | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_application_forms_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_applications: {
        Row: {
          application_number: string
          approved_amount: number | null
          approved_by: string | null
          assigned_to: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          current_stage: string
          form_id: string | null
          geolocation_accuracy: number | null
          id: string
          interest_rate: number | null
          latitude: number | null
          loan_id: string | null
          longitude: number | null
          org_id: string
          parent_application_id: string | null
          previous_stage: string | null
          product_type: string
          referred_by: string | null
          rejection_reason: string | null
          requested_amount: number
          source: string | null
          status: string
          submitted_from_ip: string | null
          tenure_days: number
          tenure_months: number | null
          updated_at: string
        }
        Insert: {
          application_number: string
          approved_amount?: number | null
          approved_by?: string | null
          assigned_to?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          current_stage?: string
          form_id?: string | null
          geolocation_accuracy?: number | null
          id?: string
          interest_rate?: number | null
          latitude?: number | null
          loan_id?: string | null
          longitude?: number | null
          org_id: string
          parent_application_id?: string | null
          previous_stage?: string | null
          product_type?: string
          referred_by?: string | null
          rejection_reason?: string | null
          requested_amount: number
          source?: string | null
          status?: string
          submitted_from_ip?: string | null
          tenure_days: number
          tenure_months?: number | null
          updated_at?: string
        }
        Update: {
          application_number?: string
          approved_amount?: number | null
          approved_by?: string | null
          assigned_to?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          current_stage?: string
          form_id?: string | null
          geolocation_accuracy?: number | null
          id?: string
          interest_rate?: number | null
          latitude?: number | null
          loan_id?: string | null
          longitude?: number | null
          org_id?: string
          parent_application_id?: string | null
          previous_stage?: string | null
          product_type?: string
          referred_by?: string | null
          rejection_reason?: string | null
          requested_amount?: number
          source?: string | null
          status?: string
          submitted_from_ip?: string | null
          tenure_days?: number
          tenure_months?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_applications_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_applications_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_applications_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_applications_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_with_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_applications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_applications_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "loan_application_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_applications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_applications_parent_application_id_fkey"
            columns: ["parent_application_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_approvals: {
        Row: {
          approval_level: string
          approval_status: string
          approved_amount: number | null
          approved_at: string | null
          approved_rate: number | null
          approved_tenure_days: number | null
          approver_id: string | null
          approver_role: string | null
          comments: string | null
          conditions: Json | null
          created_at: string
          deviation_details: Json | null
          id: string
          loan_application_id: string
          updated_at: string
        }
        Insert: {
          approval_level: string
          approval_status?: string
          approved_amount?: number | null
          approved_at?: string | null
          approved_rate?: number | null
          approved_tenure_days?: number | null
          approver_id?: string | null
          approver_role?: string | null
          comments?: string | null
          conditions?: Json | null
          created_at?: string
          deviation_details?: Json | null
          id?: string
          loan_application_id: string
          updated_at?: string
        }
        Update: {
          approval_level?: string
          approval_status?: string
          approved_amount?: number | null
          approved_at?: string | null
          approved_rate?: number | null
          approved_tenure_days?: number | null
          approver_id?: string | null
          approver_role?: string | null
          comments?: string | null
          conditions?: Json | null
          created_at?: string
          deviation_details?: Json | null
          id?: string
          loan_application_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_approvals_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_approvals_loan_application_id_fkey"
            columns: ["loan_application_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_assignment_config: {
        Row: {
          created_at: string | null
          id: string
          is_round_robin_enabled: boolean | null
          last_assigned_at: string | null
          last_assigned_user_id: string | null
          org_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_round_robin_enabled?: boolean | null
          last_assigned_at?: string | null
          last_assigned_user_id?: string | null
          org_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_round_robin_enabled?: boolean | null
          last_assigned_at?: string | null
          last_assigned_user_id?: string | null
          org_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_assignment_config_last_assigned_user_id_fkey"
            columns: ["last_assigned_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_assignment_config_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_audit_log: {
        Row: {
          action_by: string | null
          action_type: string
          created_at: string
          id: string
          ip_address: unknown
          loan_application_id: string
          new_value: Json | null
          old_value: Json | null
          user_agent: string | null
        }
        Insert: {
          action_by?: string | null
          action_type: string
          created_at?: string
          id?: string
          ip_address?: unknown
          loan_application_id: string
          new_value?: Json | null
          old_value?: Json | null
          user_agent?: string | null
        }
        Update: {
          action_by?: string | null
          action_type?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          loan_application_id?: string
          new_value?: Json | null
          old_value?: Json | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_audit_log_action_by_fkey"
            columns: ["action_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_audit_log_loan_application_id_fkey"
            columns: ["loan_application_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_bank_analysis: {
        Row: {
          analysis_data: Json | null
          analysis_source: string | null
          applicant_id: string
          average_monthly_balance: number | null
          average_salary_amount: number | null
          bounce_amount: number | null
          bounce_count: number | null
          cash_deposits: number | null
          cash_withdrawals: number | null
          created_at: string
          emi_debits: Json | null
          foir_calculated: number | null
          high_value_transactions: Json | null
          id: string
          minimum_balance: number | null
          salary_credits: Json | null
          statement_period_from: string | null
          statement_period_to: string | null
          updated_at: string
        }
        Insert: {
          analysis_data?: Json | null
          analysis_source?: string | null
          applicant_id: string
          average_monthly_balance?: number | null
          average_salary_amount?: number | null
          bounce_amount?: number | null
          bounce_count?: number | null
          cash_deposits?: number | null
          cash_withdrawals?: number | null
          created_at?: string
          emi_debits?: Json | null
          foir_calculated?: number | null
          high_value_transactions?: Json | null
          id?: string
          minimum_balance?: number | null
          salary_credits?: Json | null
          statement_period_from?: string | null
          statement_period_to?: string | null
          updated_at?: string
        }
        Update: {
          analysis_data?: Json | null
          analysis_source?: string | null
          applicant_id?: string
          average_monthly_balance?: number | null
          average_salary_amount?: number | null
          bounce_amount?: number | null
          bounce_count?: number | null
          cash_deposits?: number | null
          cash_withdrawals?: number | null
          created_at?: string
          emi_debits?: Json | null
          foir_calculated?: number | null
          high_value_transactions?: Json | null
          id?: string
          minimum_balance?: number | null
          salary_credits?: Json | null
          statement_period_from?: string | null
          statement_period_to?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_bank_analysis_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "loan_applicants"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_credit_bureau_reports: {
        Row: {
          active_accounts: number | null
          applicant_id: string
          bureau_type: string
          closed_accounts: number | null
          created_at: string
          credit_score: number | null
          dpd_history: Json | null
          enquiry_count_30d: number | null
          enquiry_count_90d: number | null
          id: string
          report_data: Json | null
          score_date: string | null
          total_outstanding: number | null
          total_overdue: number | null
        }
        Insert: {
          active_accounts?: number | null
          applicant_id: string
          bureau_type: string
          closed_accounts?: number | null
          created_at?: string
          credit_score?: number | null
          dpd_history?: Json | null
          enquiry_count_30d?: number | null
          enquiry_count_90d?: number | null
          id?: string
          report_data?: Json | null
          score_date?: string | null
          total_outstanding?: number | null
          total_overdue?: number | null
        }
        Update: {
          active_accounts?: number | null
          applicant_id?: string
          bureau_type?: string
          closed_accounts?: number | null
          created_at?: string
          credit_score?: number | null
          dpd_history?: Json | null
          enquiry_count_30d?: number | null
          enquiry_count_90d?: number | null
          id?: string
          report_data?: Json | null
          score_date?: string | null
          total_outstanding?: number | null
          total_overdue?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_credit_bureau_reports_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "loan_applicants"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_deviations: {
        Row: {
          approval_level_required: string | null
          approved_by: string | null
          created_at: string
          deviation_description: string
          deviation_type: string
          deviation_value: string | null
          id: string
          justification: string | null
          loan_application_id: string
          policy_value: string | null
          requested_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          approval_level_required?: string | null
          approved_by?: string | null
          created_at?: string
          deviation_description: string
          deviation_type: string
          deviation_value?: string | null
          id?: string
          justification?: string | null
          loan_application_id: string
          policy_value?: string | null
          requested_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          approval_level_required?: string | null
          approved_by?: string | null
          created_at?: string
          deviation_description?: string
          deviation_type?: string
          deviation_value?: string | null
          id?: string
          justification?: string | null
          loan_application_id?: string
          policy_value?: string | null
          requested_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_deviations_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_deviations_loan_application_id_fkey"
            columns: ["loan_application_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_deviations_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_disbursements: {
        Row: {
          account_number: string
          bank_name: string
          beneficiary_name: string
          created_at: string
          disbursement_amount: number
          disbursement_date: string | null
          disbursement_number: string
          failure_reason: string | null
          id: string
          ifsc_code: string
          loan_application_id: string
          org_id: string | null
          payment_mode: string | null
          proof_document_path: string | null
          proof_uploaded_at: string | null
          proof_uploaded_by: string | null
          sanction_id: string | null
          status: string
          updated_at: string
          utr_number: string | null
        }
        Insert: {
          account_number: string
          bank_name: string
          beneficiary_name: string
          created_at?: string
          disbursement_amount: number
          disbursement_date?: string | null
          disbursement_number: string
          failure_reason?: string | null
          id?: string
          ifsc_code: string
          loan_application_id: string
          org_id?: string | null
          payment_mode?: string | null
          proof_document_path?: string | null
          proof_uploaded_at?: string | null
          proof_uploaded_by?: string | null
          sanction_id?: string | null
          status?: string
          updated_at?: string
          utr_number?: string | null
        }
        Update: {
          account_number?: string
          bank_name?: string
          beneficiary_name?: string
          created_at?: string
          disbursement_amount?: number
          disbursement_date?: string | null
          disbursement_number?: string
          failure_reason?: string | null
          id?: string
          ifsc_code?: string
          loan_application_id?: string
          org_id?: string | null
          payment_mode?: string | null
          proof_document_path?: string | null
          proof_uploaded_at?: string | null
          proof_uploaded_by?: string | null
          sanction_id?: string | null
          status?: string
          updated_at?: string
          utr_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_disbursements_loan_application_id_fkey"
            columns: ["loan_application_id"]
            isOneToOne: true
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_disbursements_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_disbursements_sanction_id_fkey"
            columns: ["sanction_id"]
            isOneToOne: false
            referencedRelation: "loan_sanctions"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_document_types: {
        Row: {
          applies_to: string | null
          created_at: string
          document_category: string
          document_code: string
          document_name: string
          id: string
          is_mandatory: boolean | null
          org_id: string
          updated_at: string
          validation_rules: Json | null
        }
        Insert: {
          applies_to?: string | null
          created_at?: string
          document_category: string
          document_code: string
          document_name: string
          id?: string
          is_mandatory?: boolean | null
          org_id: string
          updated_at?: string
          validation_rules?: Json | null
        }
        Update: {
          applies_to?: string | null
          created_at?: string
          document_category?: string
          document_code?: string
          document_name?: string
          id?: string
          is_mandatory?: boolean | null
          org_id?: string
          updated_at?: string
          validation_rules?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_document_types_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_documents: {
        Row: {
          applicant_id: string | null
          created_at: string
          document_category: string
          document_type: string
          file_name: string | null
          file_path: string | null
          file_size: number | null
          id: string
          loan_application_id: string
          mime_type: string | null
          ocr_data: Json | null
          parsing_completed_at: string | null
          parsing_progress: Json | null
          parsing_started_at: string | null
          parsing_status: string | null
          rejection_reason: string | null
          updated_at: string
          upload_status: string
          verification_status: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          applicant_id?: string | null
          created_at?: string
          document_category: string
          document_type: string
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          loan_application_id: string
          mime_type?: string | null
          ocr_data?: Json | null
          parsing_completed_at?: string | null
          parsing_progress?: Json | null
          parsing_started_at?: string | null
          parsing_status?: string | null
          rejection_reason?: string | null
          updated_at?: string
          upload_status?: string
          verification_status?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          applicant_id?: string | null
          created_at?: string
          document_category?: string
          document_type?: string
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          loan_application_id?: string
          mime_type?: string | null
          ocr_data?: Json | null
          parsing_completed_at?: string | null
          parsing_progress?: Json | null
          parsing_started_at?: string | null
          parsing_status?: string | null
          rejection_reason?: string | null
          updated_at?: string
          upload_status?: string
          verification_status?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_documents_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "loan_applicants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_documents_loan_application_id_fkey"
            columns: ["loan_application_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_documents_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_eligibility: {
        Row: {
          calculation_date: string
          calculation_details: Json | null
          created_at: string
          daily_emi: number | null
          deviation_required: boolean | null
          dti_ratio: number | null
          eligible_loan_amount: number | null
          existing_emi_obligations: number | null
          foir_percentage: number | null
          gross_income: number
          id: string
          is_eligible: boolean | null
          loan_application_id: string
          ltv_ratio: number | null
          max_allowed_foir: number | null
          net_income: number
          policy_checks: Json | null
          proposed_emi: number
          recommended_interest_rate: number | null
          recommended_tenure_days: number | null
          total_deductions: number | null
          total_interest: number | null
          total_repayment: number | null
        }
        Insert: {
          calculation_date?: string
          calculation_details?: Json | null
          created_at?: string
          daily_emi?: number | null
          deviation_required?: boolean | null
          dti_ratio?: number | null
          eligible_loan_amount?: number | null
          existing_emi_obligations?: number | null
          foir_percentage?: number | null
          gross_income: number
          id?: string
          is_eligible?: boolean | null
          loan_application_id: string
          ltv_ratio?: number | null
          max_allowed_foir?: number | null
          net_income: number
          policy_checks?: Json | null
          proposed_emi: number
          recommended_interest_rate?: number | null
          recommended_tenure_days?: number | null
          total_deductions?: number | null
          total_interest?: number | null
          total_repayment?: number | null
        }
        Update: {
          calculation_date?: string
          calculation_details?: Json | null
          created_at?: string
          daily_emi?: number | null
          deviation_required?: boolean | null
          dti_ratio?: number | null
          eligible_loan_amount?: number | null
          existing_emi_obligations?: number | null
          foir_percentage?: number | null
          gross_income?: number
          id?: string
          is_eligible?: boolean | null
          loan_application_id?: string
          ltv_ratio?: number | null
          max_allowed_foir?: number | null
          net_income?: number
          policy_checks?: Json | null
          proposed_emi?: number
          recommended_interest_rate?: number | null
          recommended_tenure_days?: number | null
          total_deductions?: number | null
          total_interest?: number | null
          total_repayment?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_eligibility_loan_application_id_fkey"
            columns: ["loan_application_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_employment_details: {
        Row: {
          applicant_id: string
          created_at: string
          date_of_joining: string | null
          department: string | null
          designation: string | null
          employee_id: string | null
          employer_address: string | null
          employer_name: string
          employer_type: string | null
          employment_type: string
          gross_monthly_salary: number
          id: string
          net_monthly_salary: number
          official_email: string | null
          other_income: number | null
          other_income_source: string | null
          salary_account_number: string | null
          salary_bank_name: string | null
          salary_mode: string | null
          total_experience: number | null
          updated_at: string
          years_in_company: number | null
        }
        Insert: {
          applicant_id: string
          created_at?: string
          date_of_joining?: string | null
          department?: string | null
          designation?: string | null
          employee_id?: string | null
          employer_address?: string | null
          employer_name: string
          employer_type?: string | null
          employment_type?: string
          gross_monthly_salary: number
          id?: string
          net_monthly_salary: number
          official_email?: string | null
          other_income?: number | null
          other_income_source?: string | null
          salary_account_number?: string | null
          salary_bank_name?: string | null
          salary_mode?: string | null
          total_experience?: number | null
          updated_at?: string
          years_in_company?: number | null
        }
        Update: {
          applicant_id?: string
          created_at?: string
          date_of_joining?: string | null
          department?: string | null
          designation?: string | null
          employee_id?: string | null
          employer_address?: string | null
          employer_name?: string
          employer_type?: string | null
          employment_type?: string
          gross_monthly_salary?: number
          id?: string
          net_monthly_salary?: number
          official_email?: string | null
          other_income?: number | null
          other_income_source?: string | null
          salary_account_number?: string | null
          salary_bank_name?: string | null
          salary_mode?: string | null
          total_experience?: number | null
          updated_at?: string
          years_in_company?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_employment_details_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "loan_applicants"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_generated_documents: {
        Row: {
          created_at: string | null
          customer_signed: boolean | null
          document_number: string
          document_type: string
          file_path: string | null
          generated_at: string | null
          generated_by: string | null
          id: string
          loan_application_id: string
          org_id: string
          sanction_id: string | null
          signature_data: Json | null
          signed_at: string | null
          signed_document_path: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_signed?: boolean | null
          document_number: string
          document_type: string
          file_path?: string | null
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          loan_application_id: string
          org_id: string
          sanction_id?: string | null
          signature_data?: Json | null
          signed_at?: string | null
          signed_document_path?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_signed?: boolean | null
          document_number?: string
          document_type?: string
          file_path?: string | null
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          loan_application_id?: string
          org_id?: string
          sanction_id?: string | null
          signature_data?: Json | null
          signed_at?: string | null
          signed_document_path?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_generated_documents_loan_application_id_fkey"
            columns: ["loan_application_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_generated_documents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_generated_documents_sanction_id_fkey"
            columns: ["sanction_id"]
            isOneToOne: false
            referencedRelation: "loan_sanctions"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_income_summaries: {
        Row: {
          annual_average_income: number | null
          applicant_id: string | null
          average_monthly_income: number | null
          created_at: string | null
          id: string
          income_growth_percentage: number | null
          income_stability_score: string | null
          loan_application_id: string
          monthly_deductions: number | null
          monthly_gross_salary: number | null
          monthly_net_salary: number | null
          org_id: string
          salary_slip_details: Json | null
          source_documents: Json | null
          updated_at: string | null
          year_1_gross_income: number | null
          year_1_label: string | null
          year_1_source: string | null
          year_1_tax_paid: number | null
          year_1_taxable_income: number | null
          year_2_gross_income: number | null
          year_2_label: string | null
          year_2_source: string | null
          year_2_tax_paid: number | null
          year_2_taxable_income: number | null
        }
        Insert: {
          annual_average_income?: number | null
          applicant_id?: string | null
          average_monthly_income?: number | null
          created_at?: string | null
          id?: string
          income_growth_percentage?: number | null
          income_stability_score?: string | null
          loan_application_id: string
          monthly_deductions?: number | null
          monthly_gross_salary?: number | null
          monthly_net_salary?: number | null
          org_id: string
          salary_slip_details?: Json | null
          source_documents?: Json | null
          updated_at?: string | null
          year_1_gross_income?: number | null
          year_1_label?: string | null
          year_1_source?: string | null
          year_1_tax_paid?: number | null
          year_1_taxable_income?: number | null
          year_2_gross_income?: number | null
          year_2_label?: string | null
          year_2_source?: string | null
          year_2_tax_paid?: number | null
          year_2_taxable_income?: number | null
        }
        Update: {
          annual_average_income?: number | null
          applicant_id?: string | null
          average_monthly_income?: number | null
          created_at?: string | null
          id?: string
          income_growth_percentage?: number | null
          income_stability_score?: string | null
          loan_application_id?: string
          monthly_deductions?: number | null
          monthly_gross_salary?: number | null
          monthly_net_salary?: number | null
          org_id?: string
          salary_slip_details?: Json | null
          source_documents?: Json | null
          updated_at?: string | null
          year_1_gross_income?: number | null
          year_1_label?: string | null
          year_1_source?: string | null
          year_1_tax_paid?: number | null
          year_1_taxable_income?: number | null
          year_2_gross_income?: number | null
          year_2_label?: string | null
          year_2_source?: string | null
          year_2_tax_paid?: number | null
          year_2_taxable_income?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_income_summaries_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "loan_applicants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_income_summaries_loan_application_id_fkey"
            columns: ["loan_application_id"]
            isOneToOne: true
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_income_summaries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_negative_areas: {
        Row: {
          area_type: string
          area_value: string
          created_at: string
          id: string
          is_active: boolean | null
          org_id: string
          reason: string | null
          updated_at: string
        }
        Insert: {
          area_type: string
          area_value: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          org_id: string
          reason?: string | null
          updated_at?: string
        }
        Update: {
          area_type?: string
          area_value?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          org_id?: string
          reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_negative_areas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_payments: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          interest_paid: number
          late_fee_paid: number | null
          loan_application_id: string
          notes: string | null
          org_id: string
          payment_amount: number
          payment_date: string
          payment_method: string
          payment_number: string
          principal_paid: number
          schedule_id: string | null
          transaction_reference: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          interest_paid: number
          late_fee_paid?: number | null
          loan_application_id: string
          notes?: string | null
          org_id: string
          payment_amount: number
          payment_date: string
          payment_method: string
          payment_number: string
          principal_paid: number
          schedule_id?: string | null
          transaction_reference?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          interest_paid?: number
          late_fee_paid?: number | null
          loan_application_id?: string
          notes?: string | null
          org_id?: string
          payment_amount?: number
          payment_date?: string
          payment_method?: string
          payment_number?: string
          principal_paid?: number
          schedule_id?: string | null
          transaction_reference?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_payments_loan_application_id_fkey"
            columns: ["loan_application_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_payments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_payments_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "loan_repayment_schedule"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_policy_rules: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          org_id: string
          priority: number | null
          product_id: string | null
          rule_action: Json
          rule_condition: Json
          rule_name: string
          rule_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          org_id: string
          priority?: number | null
          product_id?: string | null
          rule_action: Json
          rule_condition: Json
          rule_name: string
          rule_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          org_id?: string
          priority?: number | null
          product_id?: string | null
          rule_action?: Json
          rule_condition?: Json
          rule_name?: string
          rule_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_policy_rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_policy_rules_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "loan_products"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_products: {
        Row: {
          base_interest_rate: number
          created_at: string
          eligibility_criteria: Json | null
          id: string
          is_active: boolean | null
          max_amount: number
          max_interest_rate: number
          max_tenure_days: number
          min_amount: number
          min_tenure_days: number
          org_id: string
          processing_fee_percentage: number | null
          product_code: string
          product_name: string
          required_documents: Json | null
          updated_at: string
        }
        Insert: {
          base_interest_rate: number
          created_at?: string
          eligibility_criteria?: Json | null
          id?: string
          is_active?: boolean | null
          max_amount: number
          max_interest_rate: number
          max_tenure_days: number
          min_amount: number
          min_tenure_days: number
          org_id: string
          processing_fee_percentage?: number | null
          product_code: string
          product_name: string
          required_documents?: Json | null
          updated_at?: string
        }
        Update: {
          base_interest_rate?: number
          created_at?: string
          eligibility_criteria?: Json | null
          id?: string
          is_active?: boolean | null
          max_amount?: number
          max_interest_rate?: number
          max_tenure_days?: number
          min_amount?: number
          min_tenure_days?: number
          org_id?: string
          processing_fee_percentage?: number | null
          product_code?: string
          product_name?: string
          required_documents?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_products_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_referrals: {
        Row: {
          address: string | null
          applicant_id: string | null
          created_at: string | null
          email: string | null
          id: string
          loan_application_id: string | null
          mobile: string | null
          name: string
          org_id: string
          referral_type: string
          relationship: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          applicant_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          loan_application_id?: string | null
          mobile?: string | null
          name: string
          org_id: string
          referral_type: string
          relationship?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          applicant_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          loan_application_id?: string | null
          mobile?: string | null
          name?: string
          org_id?: string
          referral_type?: string
          relationship?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_referrals_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "loan_applicants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_referrals_loan_application_id_fkey"
            columns: ["loan_application_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_referrals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_repayment_schedule: {
        Row: {
          amount_paid: number | null
          created_at: string | null
          due_date: string
          emi_number: number
          id: string
          interest_amount: number
          late_fee: number | null
          loan_application_id: string
          org_id: string
          outstanding_principal: number
          payment_date: string | null
          principal_amount: number
          sanction_id: string
          status: string
          total_emi: number
          updated_at: string | null
        }
        Insert: {
          amount_paid?: number | null
          created_at?: string | null
          due_date: string
          emi_number: number
          id?: string
          interest_amount: number
          late_fee?: number | null
          loan_application_id: string
          org_id: string
          outstanding_principal: number
          payment_date?: string | null
          principal_amount: number
          sanction_id: string
          status?: string
          total_emi: number
          updated_at?: string | null
        }
        Update: {
          amount_paid?: number | null
          created_at?: string | null
          due_date?: string
          emi_number?: number
          id?: string
          interest_amount?: number
          late_fee?: number | null
          loan_application_id?: string
          org_id?: string
          outstanding_principal?: number
          payment_date?: string | null
          principal_amount?: number
          sanction_id?: string
          status?: string
          total_emi?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_repayment_schedule_loan_application_id_fkey"
            columns: ["loan_application_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_repayment_schedule_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_repayment_schedule_sanction_id_fkey"
            columns: ["sanction_id"]
            isOneToOne: false
            referencedRelation: "loan_sanctions"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_sanctions: {
        Row: {
          accepted_at: string | null
          conditions: Json | null
          created_at: string
          customer_accepted: boolean | null
          customer_email: string | null
          documents_emailed_at: string | null
          gst_amount: number | null
          id: string
          loan_application_id: string
          net_disbursement_amount: number
          processing_fee: number | null
          sanction_date: string
          sanction_letter_path: string | null
          sanction_number: string
          sanctioned_amount: number
          sanctioned_rate: number
          sanctioned_tenure_days: number
          status: string
          updated_at: string
          validity_date: string | null
        }
        Insert: {
          accepted_at?: string | null
          conditions?: Json | null
          created_at?: string
          customer_accepted?: boolean | null
          customer_email?: string | null
          documents_emailed_at?: string | null
          gst_amount?: number | null
          id?: string
          loan_application_id: string
          net_disbursement_amount: number
          processing_fee?: number | null
          sanction_date: string
          sanction_letter_path?: string | null
          sanction_number: string
          sanctioned_amount: number
          sanctioned_rate?: number
          sanctioned_tenure_days: number
          status?: string
          updated_at?: string
          validity_date?: string | null
        }
        Update: {
          accepted_at?: string | null
          conditions?: Json | null
          created_at?: string
          customer_accepted?: boolean | null
          customer_email?: string | null
          documents_emailed_at?: string | null
          gst_amount?: number | null
          id?: string
          loan_application_id?: string
          net_disbursement_amount?: number
          processing_fee?: number | null
          sanction_date?: string
          sanction_letter_path?: string | null
          sanction_number?: string
          sanctioned_amount?: number
          sanctioned_rate?: number
          sanctioned_tenure_days?: number
          status?: string
          updated_at?: string
          validity_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_sanctions_loan_application_id_fkey"
            columns: ["loan_application_id"]
            isOneToOne: true
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_stage_history: {
        Row: {
          comments: string | null
          from_stage: string | null
          id: string
          loan_application_id: string
          moved_at: string
          moved_by: string | null
          reason: string | null
          time_in_stage_minutes: number | null
          to_stage: string
        }
        Insert: {
          comments?: string | null
          from_stage?: string | null
          id?: string
          loan_application_id: string
          moved_at?: string
          moved_by?: string | null
          reason?: string | null
          time_in_stage_minutes?: number | null
          to_stage: string
        }
        Update: {
          comments?: string | null
          from_stage?: string | null
          id?: string
          loan_application_id?: string
          moved_at?: string
          moved_by?: string | null
          reason?: string | null
          time_in_stage_minutes?: number | null
          to_stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_stage_history_loan_application_id_fkey"
            columns: ["loan_application_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_stage_history_moved_by_fkey"
            columns: ["moved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_verifications: {
        Row: {
          applicant_id: string | null
          created_at: string
          id: string
          loan_application_id: string
          remarks: string | null
          request_data: Json | null
          response_data: Json | null
          status: string
          updated_at: string
          verification_source: string | null
          verification_type: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          applicant_id?: string | null
          created_at?: string
          id?: string
          loan_application_id: string
          remarks?: string | null
          request_data?: Json | null
          response_data?: Json | null
          status?: string
          updated_at?: string
          verification_source?: string | null
          verification_type: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          applicant_id?: string | null
          created_at?: string
          id?: string
          loan_application_id?: string
          remarks?: string | null
          request_data?: Json | null
          response_data?: Json | null
          status?: string
          updated_at?: string
          verification_source?: string | null
          verification_type?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_verifications_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "loan_applicants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_verifications_loan_application_id_fkey"
            columns: ["loan_application_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_verifications_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          expires_at: string | null
          id: string
          is_read: boolean | null
          message: string
          metadata: Json | null
          org_id: string
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          expires_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          metadata?: Json | null
          org_id: string
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          expires_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          metadata?: Json | null
          org_id?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      nupay_auth_tokens: {
        Row: {
          created_at: string
          environment: string
          expires_at: string
          id: string
          org_id: string
          token: string
        }
        Insert: {
          created_at?: string
          environment: string
          expires_at: string
          id?: string
          org_id: string
          token: string
        }
        Update: {
          created_at?: string
          environment?: string
          expires_at?: string
          id?: string
          org_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "nupay_auth_tokens_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      nupay_banks: {
        Row: {
          bank_code: string
          bank_id: number
          cached_at: string
          id: number
          is_active: boolean | null
          mode: string
          name: string
          org_id: string
        }
        Insert: {
          bank_code: string
          bank_id: number
          cached_at?: string
          id?: number
          is_active?: boolean | null
          mode: string
          name: string
          org_id: string
        }
        Update: {
          bank_code?: string
          bank_id?: number
          cached_at?: string
          id?: number
          is_active?: boolean | null
          mode?: string
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nupay_banks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      nupay_config: {
        Row: {
          access_key: string | null
          access_secret: string | null
          api_endpoint: string
          api_key: string
          collection_api_endpoint: string | null
          collection_enabled: boolean | null
          created_at: string
          environment: string
          esign_api_endpoint: string | null
          esign_api_key: string | null
          id: string
          is_active: boolean | null
          org_id: string
          provider_id: string | null
          redirect_url: string | null
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          access_key?: string | null
          access_secret?: string | null
          api_endpoint?: string
          api_key: string
          collection_api_endpoint?: string | null
          collection_enabled?: boolean | null
          created_at?: string
          environment: string
          esign_api_endpoint?: string | null
          esign_api_key?: string | null
          id?: string
          is_active?: boolean | null
          org_id: string
          provider_id?: string | null
          redirect_url?: string | null
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          access_key?: string | null
          access_secret?: string | null
          api_endpoint?: string
          api_key?: string
          collection_api_endpoint?: string | null
          collection_enabled?: boolean | null
          created_at?: string
          environment?: string
          esign_api_endpoint?: string | null
          esign_api_key?: string | null
          id?: string
          is_active?: boolean | null
          org_id?: string
          provider_id?: string | null
          redirect_url?: string | null
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nupay_config_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      nupay_mandates: {
        Row: {
          account_holder_name: string
          account_type: string
          additional_data: Json | null
          auth_type: string | null
          bank_account_no: string
          bank_id: number
          bank_name: string | null
          category_id: number
          collection_amount: number
          collection_until_cancel: boolean | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          debit_type: boolean | null
          email: string | null
          expires_at: string | null
          final_collection_date: string | null
          first_collection_date: string
          frequency: string
          id: string
          ifsc_code: string | null
          loan_application_id: string
          loan_no: string
          mobile_no: string
          npci_ref: string | null
          nupay_id: string | null
          nupay_ref_no: string | null
          org_id: string
          registration_url: string | null
          rejected_by: string | null
          rejection_reason_code: string | null
          rejection_reason_desc: string | null
          request_payload: Json | null
          response_payload: Json | null
          seq_type: string
          status: string
          umrn: string | null
          updated_at: string
          webhook_payload: Json | null
        }
        Insert: {
          account_holder_name: string
          account_type: string
          additional_data?: Json | null
          auth_type?: string | null
          bank_account_no: string
          bank_id: number
          bank_name?: string | null
          category_id?: number
          collection_amount: number
          collection_until_cancel?: boolean | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          debit_type?: boolean | null
          email?: string | null
          expires_at?: string | null
          final_collection_date?: string | null
          first_collection_date: string
          frequency: string
          id?: string
          ifsc_code?: string | null
          loan_application_id: string
          loan_no: string
          mobile_no: string
          npci_ref?: string | null
          nupay_id?: string | null
          nupay_ref_no?: string | null
          org_id: string
          registration_url?: string | null
          rejected_by?: string | null
          rejection_reason_code?: string | null
          rejection_reason_desc?: string | null
          request_payload?: Json | null
          response_payload?: Json | null
          seq_type: string
          status?: string
          umrn?: string | null
          updated_at?: string
          webhook_payload?: Json | null
        }
        Update: {
          account_holder_name?: string
          account_type?: string
          additional_data?: Json | null
          auth_type?: string | null
          bank_account_no?: string
          bank_id?: number
          bank_name?: string | null
          category_id?: number
          collection_amount?: number
          collection_until_cancel?: boolean | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          debit_type?: boolean | null
          email?: string | null
          expires_at?: string | null
          final_collection_date?: string | null
          first_collection_date?: string
          frequency?: string
          id?: string
          ifsc_code?: string | null
          loan_application_id?: string
          loan_no?: string
          mobile_no?: string
          npci_ref?: string | null
          nupay_id?: string | null
          nupay_ref_no?: string | null
          org_id?: string
          registration_url?: string | null
          rejected_by?: string | null
          rejection_reason_code?: string | null
          rejection_reason_desc?: string | null
          request_payload?: Json | null
          response_payload?: Json | null
          seq_type?: string
          status?: string
          umrn?: string | null
          updated_at?: string
          webhook_payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "nupay_mandates_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nupay_mandates_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_with_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nupay_mandates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nupay_mandates_loan_application_id_fkey"
            columns: ["loan_application_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nupay_mandates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      nupay_upi_auth_tokens: {
        Row: {
          created_at: string | null
          environment: string
          expires_at: string
          id: string
          org_id: string
          token: string
        }
        Insert: {
          created_at?: string | null
          environment: string
          expires_at: string
          id?: string
          org_id: string
          token: string
        }
        Update: {
          created_at?: string | null
          environment?: string
          expires_at?: string
          id?: string
          org_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "nupay_upi_auth_tokens_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      nupay_upi_transactions: {
        Row: {
          client_reference_id: string
          convenience_fee: number | null
          created_at: string | null
          created_by: string | null
          customer_unique_id: string | null
          expires_at: string | null
          gst_amount: number | null
          id: string
          loan_application_id: string
          npci_transaction_id: string | null
          nupay_reference_id: string | null
          org_id: string
          payee_vpa: string | null
          payer_email: string | null
          payer_mobile: string | null
          payer_name: string | null
          payer_vpa: string | null
          payment_link: string | null
          request_amount: number
          request_payload: Json | null
          response_payload: Json | null
          schedule_id: string | null
          status: string
          status_description: string | null
          transaction_amount: number | null
          transaction_id: string | null
          transaction_timestamp: string | null
          updated_at: string | null
          utr: string | null
          webhook_payload: Json | null
        }
        Insert: {
          client_reference_id: string
          convenience_fee?: number | null
          created_at?: string | null
          created_by?: string | null
          customer_unique_id?: string | null
          expires_at?: string | null
          gst_amount?: number | null
          id?: string
          loan_application_id: string
          npci_transaction_id?: string | null
          nupay_reference_id?: string | null
          org_id: string
          payee_vpa?: string | null
          payer_email?: string | null
          payer_mobile?: string | null
          payer_name?: string | null
          payer_vpa?: string | null
          payment_link?: string | null
          request_amount: number
          request_payload?: Json | null
          response_payload?: Json | null
          schedule_id?: string | null
          status?: string
          status_description?: string | null
          transaction_amount?: number | null
          transaction_id?: string | null
          transaction_timestamp?: string | null
          updated_at?: string | null
          utr?: string | null
          webhook_payload?: Json | null
        }
        Update: {
          client_reference_id?: string
          convenience_fee?: number | null
          created_at?: string | null
          created_by?: string | null
          customer_unique_id?: string | null
          expires_at?: string | null
          gst_amount?: number | null
          id?: string
          loan_application_id?: string
          npci_transaction_id?: string | null
          nupay_reference_id?: string | null
          org_id?: string
          payee_vpa?: string | null
          payer_email?: string | null
          payer_mobile?: string | null
          payer_name?: string | null
          payer_vpa?: string | null
          payment_link?: string | null
          request_amount?: number
          request_payload?: Json | null
          response_payload?: Json | null
          schedule_id?: string | null
          status?: string
          status_description?: string | null
          transaction_amount?: number | null
          transaction_id?: string | null
          transaction_timestamp?: string | null
          updated_at?: string | null
          utr?: string | null
          webhook_payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "nupay_upi_transactions_loan_application_id_fkey"
            columns: ["loan_application_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nupay_upi_transactions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nupay_upi_transactions_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "loan_repayment_schedule"
            referencedColumns: ["id"]
          },
        ]
      }
      operation_queue: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          operation_type: string
          org_id: string
          payload: Json
          priority: number
          result: Json | null
          scheduled_at: string | null
          started_at: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          operation_type: string
          org_id: string
          payload?: Json
          priority?: number
          result?: Json | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          operation_type?: string
          org_id?: string
          payload?: Json
          priority?: number
          result?: Json | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operation_queue_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operation_queue_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      org_business_hours: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          is_enabled: boolean
          org_id: string
          start_time: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          is_enabled?: boolean
          org_id: string
          start_time: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_enabled?: boolean
          org_id?: string
          start_time?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_business_hours_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_loan_settings: {
        Row: {
          bounce_charges: number
          company_address: string | null
          company_cin: string | null
          company_name: string | null
          company_phone: string | null
          created_at: string | null
          foreclosure_rate: number | null
          grievance_email: string | null
          grievance_phone: string | null
          gst_on_processing_fee: number | null
          id: string
          insurance_charges: number | null
          jurisdiction: string | null
          logo_url: string | null
          org_id: string
          penal_interest_rate: number
          registered_office_address: string | null
          updated_at: string | null
        }
        Insert: {
          bounce_charges?: number
          company_address?: string | null
          company_cin?: string | null
          company_name?: string | null
          company_phone?: string | null
          created_at?: string | null
          foreclosure_rate?: number | null
          grievance_email?: string | null
          grievance_phone?: string | null
          gst_on_processing_fee?: number | null
          id?: string
          insurance_charges?: number | null
          jurisdiction?: string | null
          logo_url?: string | null
          org_id: string
          penal_interest_rate?: number
          registered_office_address?: string | null
          updated_at?: string | null
        }
        Update: {
          bounce_charges?: number
          company_address?: string | null
          company_cin?: string | null
          company_name?: string | null
          company_phone?: string | null
          created_at?: string | null
          foreclosure_rate?: number | null
          grievance_email?: string | null
          grievance_phone?: string | null
          gst_on_processing_fee?: number | null
          id?: string
          insurance_charges?: number | null
          jurisdiction?: string | null
          logo_url?: string | null
          org_id?: string
          penal_interest_rate?: number
          registered_office_address?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_loan_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_subscriptions: {
        Row: {
          billing_cycle_start: string
          created_at: string | null
          grace_period_end: string | null
          id: string
          last_payment_date: string | null
          lockout_date: string | null
          monthly_subscription_amount: number
          next_billing_date: string
          one_time_setup_fee: number | null
          org_id: string
          override_by: string | null
          override_reason: string | null
          readonly_period_end: string | null
          subscription_status: string
          suspension_date: string | null
          suspension_override_until: string | null
          suspension_reason: string | null
          updated_at: string | null
          user_count: number
          wallet_auto_topup_enabled: boolean | null
          wallet_balance: number
          wallet_last_topup_date: string | null
          wallet_minimum_balance: number
        }
        Insert: {
          billing_cycle_start: string
          created_at?: string | null
          grace_period_end?: string | null
          id?: string
          last_payment_date?: string | null
          lockout_date?: string | null
          monthly_subscription_amount?: number
          next_billing_date: string
          one_time_setup_fee?: number | null
          org_id: string
          override_by?: string | null
          override_reason?: string | null
          readonly_period_end?: string | null
          subscription_status?: string
          suspension_date?: string | null
          suspension_override_until?: string | null
          suspension_reason?: string | null
          updated_at?: string | null
          user_count?: number
          wallet_auto_topup_enabled?: boolean | null
          wallet_balance?: number
          wallet_last_topup_date?: string | null
          wallet_minimum_balance?: number
        }
        Update: {
          billing_cycle_start?: string
          created_at?: string | null
          grace_period_end?: string | null
          id?: string
          last_payment_date?: string | null
          lockout_date?: string | null
          monthly_subscription_amount?: number
          next_billing_date?: string
          one_time_setup_fee?: number | null
          org_id?: string
          override_by?: string | null
          override_reason?: string | null
          readonly_period_end?: string | null
          subscription_status?: string
          suspension_date?: string | null
          suspension_override_until?: string | null
          suspension_reason?: string | null
          updated_at?: string | null
          user_count?: number
          wallet_auto_topup_enabled?: boolean | null
          wallet_balance?: number
          wallet_last_topup_date?: string | null
          wallet_minimum_balance?: number
        }
        Relationships: [
          {
            foreignKeyName: "organization_subscriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          apollo_config: Json | null
          created_at: string | null
          id: string
          logo_url: string | null
          max_automation_emails_per_day: number | null
          name: string
          primary_color: string | null
          services_enabled: boolean | null
          settings: Json | null
          slug: string
          subscription_active: boolean | null
          updated_at: string | null
          usage_limits: Json | null
        }
        Insert: {
          apollo_config?: Json | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          max_automation_emails_per_day?: number | null
          name: string
          primary_color?: string | null
          services_enabled?: boolean | null
          settings?: Json | null
          slug: string
          subscription_active?: boolean | null
          updated_at?: string | null
          usage_limits?: Json | null
        }
        Update: {
          apollo_config?: Json | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          max_automation_emails_per_day?: number | null
          name?: string
          primary_color?: string | null
          services_enabled?: boolean | null
          settings?: Json | null
          slug?: string
          subscription_active?: boolean | null
          updated_at?: string | null
          usage_limits?: Json | null
        }
        Relationships: []
      }
      otp_verifications: {
        Row: {
          attempts: number
          contact_id: string | null
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          max_attempts: number
          org_id: string
          otp_code: string
          target: string
          verification_type: string
          verified_at: string | null
        }
        Insert: {
          attempts?: number
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          max_attempts?: number
          org_id: string
          otp_code: string
          target: string
          verification_type: string
          verified_at?: string | null
        }
        Update: {
          attempts?: number
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          max_attempts?: number
          org_id?: string
          otp_code?: string
          target?: string
          verification_type?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "otp_verifications_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "otp_verifications_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_with_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "otp_verifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      outbound_webhook_logs: {
        Row: {
          error_message: string | null
          execution_time_ms: number | null
          id: string
          org_id: string
          payload_sent: Json
          response_body: string | null
          response_status: number | null
          retry_count: number | null
          sent_at: string | null
          succeeded: boolean | null
          trigger_data: Json
          trigger_event: string
          webhook_id: string
        }
        Insert: {
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          org_id: string
          payload_sent: Json
          response_body?: string | null
          response_status?: number | null
          retry_count?: number | null
          sent_at?: string | null
          succeeded?: boolean | null
          trigger_data: Json
          trigger_event: string
          webhook_id: string
        }
        Update: {
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          org_id?: string
          payload_sent?: Json
          response_body?: string | null
          response_status?: number | null
          retry_count?: number | null
          sent_at?: string | null
          succeeded?: boolean | null
          trigger_data?: Json
          trigger_event?: string
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outbound_webhook_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_webhook_logs_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "outbound_webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      outbound_webhooks: {
        Row: {
          authentication_config: Json | null
          authentication_type: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          filter_conditions: Json | null
          headers: Json | null
          http_method: string | null
          id: string
          is_active: boolean | null
          last_executed_at: string | null
          name: string
          org_id: string
          payload_template: Json | null
          retry_config: Json | null
          target_operation: string
          target_table: string
          total_executions: number | null
          total_failures: number | null
          trigger_event: string
          updated_at: string | null
          webhook_url: string
        }
        Insert: {
          authentication_config?: Json | null
          authentication_type?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          filter_conditions?: Json | null
          headers?: Json | null
          http_method?: string | null
          id?: string
          is_active?: boolean | null
          last_executed_at?: string | null
          name: string
          org_id: string
          payload_template?: Json | null
          retry_config?: Json | null
          target_operation?: string
          target_table?: string
          total_executions?: number | null
          total_failures?: number | null
          trigger_event: string
          updated_at?: string | null
          webhook_url: string
        }
        Update: {
          authentication_config?: Json | null
          authentication_type?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          filter_conditions?: Json | null
          headers?: Json | null
          http_method?: string | null
          id?: string
          is_active?: boolean | null
          last_executed_at?: string | null
          name?: string
          org_id?: string
          payload_template?: Json | null
          retry_config?: Json | null
          target_operation?: string
          target_table?: string
          total_executions?: number | null
          total_failures?: number | null
          trigger_event?: string
          updated_at?: string | null
          webhook_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "outbound_webhooks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount: number
          completed_at: string | null
          created_at: string | null
          failure_reason: string | null
          id: string
          initiated_at: string | null
          initiated_by: string | null
          invoice_id: string | null
          metadata: Json | null
          org_id: string
          payment_method: string | null
          payment_status: string
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          razorpay_signature: string | null
          transaction_type: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          completed_at?: string | null
          created_at?: string | null
          failure_reason?: string | null
          id?: string
          initiated_at?: string | null
          initiated_by?: string | null
          invoice_id?: string | null
          metadata?: Json | null
          org_id: string
          payment_method?: string | null
          payment_status?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          transaction_type: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          completed_at?: string | null
          created_at?: string | null
          failure_reason?: string | null
          id?: string
          initiated_at?: string | null
          initiated_by?: string | null
          invoice_id?: string | null
          metadata?: Json | null
          org_id?: string
          payment_method?: string | null
          payment_status?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          transaction_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "subscription_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_benchmarks: {
        Row: {
          avg_days_in_stage: number | null
          calculated_at: string
          conversion_rate: number | null
          created_at: string
          id: string
          org_id: string
          period_end: string
          period_start: string
          stage_id: string
          total_contacts_processed: number | null
        }
        Insert: {
          avg_days_in_stage?: number | null
          calculated_at?: string
          conversion_rate?: number | null
          created_at?: string
          id?: string
          org_id: string
          period_end: string
          period_start: string
          stage_id: string
          total_contacts_processed?: number | null
        }
        Update: {
          avg_days_in_stage?: number | null
          calculated_at?: string
          conversion_rate?: number | null
          created_at?: string
          id?: string
          org_id?: string
          period_end?: string
          period_start?: string
          stage_id?: string
          total_contacts_processed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_benchmarks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_benchmarks_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_movement_history: {
        Row: {
          contact_id: string
          created_at: string
          days_in_previous_stage: number | null
          from_stage_id: string | null
          id: string
          moved_at: string
          moved_by: string | null
          org_id: string
          to_stage_id: string | null
        }
        Insert: {
          contact_id: string
          created_at?: string
          days_in_previous_stage?: number | null
          from_stage_id?: string | null
          id?: string
          moved_at?: string
          moved_by?: string | null
          org_id: string
          to_stage_id?: string | null
        }
        Update: {
          contact_id?: string
          created_at?: string
          days_in_previous_stage?: number | null
          from_stage_id?: string | null
          id?: string
          moved_at?: string
          moved_by?: string | null
          org_id?: string
          to_stage_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_movement_history_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_movement_history_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_with_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_movement_history_from_stage_id_fkey"
            columns: ["from_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_movement_history_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_movement_history_to_stage_id_fkey"
            columns: ["to_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          org_id: string
          probability: number | null
          stage_order: number
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          org_id: string
          probability?: number | null
          stage_order: number
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          org_id?: string
          probability?: number | null
          stage_order?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_email_sending_list: {
        Row: {
          bounce_count: number
          created_at: string
          email: string
          first_seen_at: string
          id: string
          is_unsubscribed: boolean
          last_bounce_at: string | null
          last_synced_at: string
          name: string | null
          source_type: string
          updated_at: string
        }
        Insert: {
          bounce_count?: number
          created_at?: string
          email: string
          first_seen_at?: string
          id?: string
          is_unsubscribed?: boolean
          last_bounce_at?: string | null
          last_synced_at?: string
          name?: string | null
          source_type: string
          updated_at?: string
        }
        Update: {
          bounce_count?: number
          created_at?: string
          email?: string
          first_seen_at?: string
          id?: string
          is_unsubscribed?: boolean
          last_bounce_at?: string | null
          last_synced_at?: string
          name?: string | null
          source_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          calling_enabled: boolean | null
          created_at: string | null
          designation_id: string | null
          email: string | null
          email_enabled: boolean | null
          first_name: string | null
          id: string
          is_active: boolean
          last_name: string | null
          onboarding_completed: boolean | null
          org_id: string | null
          phone: string | null
          sms_enabled: boolean | null
          updated_at: string | null
          whatsapp_enabled: boolean | null
        }
        Insert: {
          avatar_url?: string | null
          calling_enabled?: boolean | null
          created_at?: string | null
          designation_id?: string | null
          email?: string | null
          email_enabled?: boolean | null
          first_name?: string | null
          id: string
          is_active?: boolean
          last_name?: string | null
          onboarding_completed?: boolean | null
          org_id?: string | null
          phone?: string | null
          sms_enabled?: boolean | null
          updated_at?: string | null
          whatsapp_enabled?: boolean | null
        }
        Update: {
          avatar_url?: string | null
          calling_enabled?: boolean | null
          created_at?: string | null
          designation_id?: string | null
          email?: string | null
          email_enabled?: boolean | null
          first_name?: string | null
          id?: string
          is_active?: boolean
          last_name?: string | null
          onboarding_completed?: boolean | null
          org_id?: string | null
          phone?: string | null
          sms_enabled?: boolean | null
          updated_at?: string | null
          whatsapp_enabled?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_designation_id_fkey"
            columns: ["designation_id"]
            isOneToOne: false
            referencedRelation: "designations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      public_otp_verifications: {
        Row: {
          attempts: number
          created_at: string
          expires_at: string
          id: string
          identifier: string
          identifier_type: string
          ip_address: unknown
          max_attempts: number
          otp_code: string
          session_id: string
          verified_at: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          expires_at?: string
          id?: string
          identifier: string
          identifier_type: string
          ip_address?: unknown
          max_attempts?: number
          otp_code: string
          session_id?: string
          verified_at?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          expires_at?: string
          id?: string
          identifier?: string
          identifier_type?: string
          ip_address?: unknown
          max_attempts?: number
          otp_code?: string
          session_id?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      rate_limit_log: {
        Row: {
          created_at: string
          id: string
          ip_address: unknown
          operation: string
          org_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address?: unknown
          operation: string
          org_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: unknown
          operation?: string
          org_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      redefine_data_repository: {
        Row: {
          address: string | null
          city: string | null
          company_name: string | null
          created_at: string | null
          created_by: string | null
          department: string | null
          designation: string | null
          employee_size: string | null
          erp_name: string | null
          erp_vendor: string | null
          generic_email: string | null
          id: string
          industry_type: string | null
          job_level: string | null
          linkedin_url: string | null
          location: string | null
          mobile_2: string | null
          mobile_number: string | null
          name: string
          official_email: string | null
          org_id: string
          personal_email: string | null
          pincode: string | null
          state: string | null
          sub_industry: string | null
          tier: string | null
          turnover: string | null
          updated_at: string | null
          website: string | null
          zone: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          company_name?: string | null
          created_at?: string | null
          created_by?: string | null
          department?: string | null
          designation?: string | null
          employee_size?: string | null
          erp_name?: string | null
          erp_vendor?: string | null
          generic_email?: string | null
          id?: string
          industry_type?: string | null
          job_level?: string | null
          linkedin_url?: string | null
          location?: string | null
          mobile_2?: string | null
          mobile_number?: string | null
          name: string
          official_email?: string | null
          org_id: string
          personal_email?: string | null
          pincode?: string | null
          state?: string | null
          sub_industry?: string | null
          tier?: string | null
          turnover?: string | null
          updated_at?: string | null
          website?: string | null
          zone?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          company_name?: string | null
          created_at?: string | null
          created_by?: string | null
          department?: string | null
          designation?: string | null
          employee_size?: string | null
          erp_name?: string | null
          erp_vendor?: string | null
          generic_email?: string | null
          id?: string
          industry_type?: string | null
          job_level?: string | null
          linkedin_url?: string | null
          location?: string | null
          mobile_2?: string | null
          mobile_number?: string | null
          name?: string
          official_email?: string | null
          org_id?: string
          personal_email?: string | null
          pincode?: string | null
          state?: string | null
          sub_industry?: string | null
          tier?: string | null
          turnover?: string | null
          updated_at?: string | null
          website?: string | null
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "redefine_data_repository_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      redefine_repository_audit: {
        Row: {
          action: string
          changed_at: string | null
          changed_by: string | null
          id: string
          new_values: Json | null
          old_values: Json | null
          repository_record_id: string | null
        }
        Insert: {
          action: string
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          repository_record_id?: string | null
        }
        Update: {
          action?: string
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          repository_record_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "redefine_repository_audit_repository_record_id_fkey"
            columns: ["repository_record_id"]
            isOneToOne: false
            referencedRelation: "redefine_data_repository"
            referencedColumns: ["id"]
          },
        ]
      }
      reporting_hierarchy: {
        Row: {
          created_at: string | null
          designation_id: string
          id: string
          org_id: string
          reports_to_designation_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          designation_id: string
          id?: string
          org_id: string
          reports_to_designation_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          designation_id?: string
          id?: string
          org_id?: string
          reports_to_designation_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reporting_hierarchy_designation_id_fkey"
            columns: ["designation_id"]
            isOneToOne: true
            referencedRelation: "designations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reporting_hierarchy_reports_to_designation_id_fkey"
            columns: ["reports_to_designation_id"]
            isOneToOne: false
            referencedRelation: "designations"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_reports: {
        Row: {
          configuration: Json
          created_at: string
          created_by: string | null
          data_source: string
          description: string | null
          id: string
          is_public: boolean
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          configuration?: Json
          created_at?: string
          created_by?: string | null
          data_source: string
          description?: string | null
          id?: string
          is_public?: boolean
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          configuration?: Json
          created_at?: string
          created_by?: string | null
          data_source?: string
          description?: string | null
          id?: string
          is_public?: boolean
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_reports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      service_usage_logs: {
        Row: {
          cost: number
          created_at: string | null
          deduction_error: string | null
          id: string
          org_id: string
          quantity: number
          reference_id: string
          service_type: string
          user_id: string | null
          wallet_deducted: boolean | null
          wallet_transaction_id: string | null
        }
        Insert: {
          cost: number
          created_at?: string | null
          deduction_error?: string | null
          id?: string
          org_id: string
          quantity: number
          reference_id: string
          service_type: string
          user_id?: string | null
          wallet_deducted?: boolean | null
          wallet_transaction_id?: string | null
        }
        Update: {
          cost?: number
          created_at?: string | null
          deduction_error?: string | null
          id?: string
          org_id?: string
          quantity?: number
          reference_id?: string
          service_type?: string
          user_id?: string | null
          wallet_deducted?: boolean | null
          wallet_transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_usage_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_usage_logs_wallet_transaction_id_fkey"
            columns: ["wallet_transaction_id"]
            isOneToOne: false
            referencedRelation: "wallet_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_automation_cooldowns: {
        Row: {
          contact_id: string
          id: string
          last_sent_at: string
          org_id: string
          rule_id: string
          send_count: number
        }
        Insert: {
          contact_id: string
          id?: string
          last_sent_at?: string
          org_id: string
          rule_id: string
          send_count?: number
        }
        Update: {
          contact_id?: string
          id?: string
          last_sent_at?: string
          org_id?: string
          rule_id?: string
          send_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "sms_automation_cooldowns_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_automation_cooldowns_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_with_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_automation_cooldowns_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_automation_cooldowns_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "sms_automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_automation_executions: {
        Row: {
          contact_id: string | null
          created_at: string
          error_message: string | null
          id: string
          loan_application_id: string | null
          org_id: string
          rule_id: string
          scheduled_for: string | null
          sent_at: string | null
          sms_message_id: string | null
          status: string
          trigger_data: Json | null
          trigger_type: string
          updated_at: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          loan_application_id?: string | null
          org_id: string
          rule_id: string
          scheduled_for?: string | null
          sent_at?: string | null
          sms_message_id?: string | null
          status?: string
          trigger_data?: Json | null
          trigger_type: string
          updated_at?: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          loan_application_id?: string | null
          org_id?: string
          rule_id?: string
          scheduled_for?: string | null
          sent_at?: string | null
          sms_message_id?: string | null
          status?: string
          trigger_data?: Json | null
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_automation_executions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_automation_executions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_with_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_automation_executions_loan_application_id_fkey"
            columns: ["loan_application_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_automation_executions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_automation_executions_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "sms_automation_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_automation_executions_sms_message_id_fkey"
            columns: ["sms_message_id"]
            isOneToOne: false
            referencedRelation: "sms_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_automation_rules: {
        Row: {
          condition_logic: string | null
          conditions: Json | null
          cooldown_period_days: number | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          max_sends_per_contact: number | null
          name: string
          org_id: string
          priority: number | null
          send_delay_minutes: number | null
          sms_template_id: string | null
          total_failed: number | null
          total_sent: number | null
          total_triggered: number | null
          trigger_config: Json
          trigger_type: string
          updated_at: string
        }
        Insert: {
          condition_logic?: string | null
          conditions?: Json | null
          cooldown_period_days?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          max_sends_per_contact?: number | null
          name: string
          org_id: string
          priority?: number | null
          send_delay_minutes?: number | null
          sms_template_id?: string | null
          total_failed?: number | null
          total_sent?: number | null
          total_triggered?: number | null
          trigger_config?: Json
          trigger_type: string
          updated_at?: string
        }
        Update: {
          condition_logic?: string | null
          conditions?: Json | null
          cooldown_period_days?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          max_sends_per_contact?: number | null
          name?: string
          org_id?: string
          priority?: number | null
          send_delay_minutes?: number | null
          sms_template_id?: string | null
          total_failed?: number | null
          total_sent?: number | null
          total_triggered?: number | null
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_automation_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_automation_rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_automation_rules_sms_template_id_fkey"
            columns: ["sms_template_id"]
            isOneToOne: false
            referencedRelation: "communication_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_messages: {
        Row: {
          contact_id: string | null
          created_at: string
          delivered_at: string | null
          dlt_template_id: string | null
          error_message: string | null
          exotel_sid: string | null
          id: string
          loan_application_id: string | null
          message_content: string
          org_id: string
          phone_number: string
          sent_at: string | null
          sent_by: string | null
          status: string
          template_id: string | null
          template_variables: Json | null
          trigger_type: string
          updated_at: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          delivered_at?: string | null
          dlt_template_id?: string | null
          error_message?: string | null
          exotel_sid?: string | null
          id?: string
          loan_application_id?: string | null
          message_content: string
          org_id: string
          phone_number: string
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          template_id?: string | null
          template_variables?: Json | null
          trigger_type?: string
          updated_at?: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          delivered_at?: string | null
          dlt_template_id?: string | null
          error_message?: string | null
          exotel_sid?: string | null
          id?: string
          loan_application_id?: string | null
          message_content?: string
          org_id?: string
          phone_number?: string
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          template_id?: string | null
          template_variables?: Json | null
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_with_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_messages_loan_application_id_fkey"
            columns: ["loan_application_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_messages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_messages_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_messages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "communication_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_templates: {
        Row: {
          category: string | null
          char_count: number | null
          content: string
          created_at: string
          dlt_template_id: string
          id: string
          is_active: boolean | null
          language: string | null
          name: string
          org_id: string
          updated_at: string
          variables: Json | null
        }
        Insert: {
          category?: string | null
          char_count?: number | null
          content: string
          created_at?: string
          dlt_template_id: string
          id?: string
          is_active?: boolean | null
          language?: string | null
          name: string
          org_id: string
          updated_at?: string
          variables?: Json | null
        }
        Update: {
          category?: string | null
          char_count?: number | null
          content?: string
          created_at?: string
          dlt_template_id?: string
          id?: string
          is_active?: boolean | null
          language?: string | null
          name?: string
          org_id?: string
          updated_at?: string
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_audit_log: {
        Row: {
          action: string
          created_at: string | null
          id: string
          new_values: Json | null
          old_values: Json | null
          org_id: string | null
          performed_by: string
          reason: string
          target_record_id: string | null
          target_record_type: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          org_id?: string | null
          performed_by: string
          reason: string
          target_record_id?: string | null
          target_record_type?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          org_id?: string | null
          performed_by?: string
          reason?: string
          target_record_id?: string | null
          target_record_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_invoices: {
        Row: {
          base_subscription_amount: number
          billing_period_end: string
          billing_period_start: string
          created_at: string | null
          due_date: string
          gst_amount: number
          id: string
          invoice_date: string
          invoice_number: string
          org_id: string
          paid_amount: number | null
          paid_at: string | null
          payment_status: string
          prorated_amount: number | null
          setup_fee: number | null
          subtotal: number
          total_amount: number
          updated_at: string | null
          user_count: number
          waive_reason: string | null
          waived_by: string | null
        }
        Insert: {
          base_subscription_amount: number
          billing_period_end: string
          billing_period_start: string
          created_at?: string | null
          due_date: string
          gst_amount: number
          id?: string
          invoice_date: string
          invoice_number: string
          org_id: string
          paid_amount?: number | null
          paid_at?: string | null
          payment_status?: string
          prorated_amount?: number | null
          setup_fee?: number | null
          subtotal: number
          total_amount: number
          updated_at?: string | null
          user_count: number
          waive_reason?: string | null
          waived_by?: string | null
        }
        Update: {
          base_subscription_amount?: number
          billing_period_end?: string
          billing_period_start?: string
          created_at?: string | null
          due_date?: string
          gst_amount?: number
          id?: string
          invoice_date?: string
          invoice_number?: string
          org_id?: string
          paid_amount?: number | null
          paid_at?: string | null
          payment_status?: string
          prorated_amount?: number | null
          setup_fee?: number | null
          subtotal?: number
          total_amount?: number
          updated_at?: string | null
          user_count?: number
          waive_reason?: string | null
          waived_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_invoices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_notifications: {
        Row: {
          created_at: string | null
          email_subject: string
          id: string
          invoice_id: string | null
          metadata: Json | null
          notification_type: string
          org_id: string
          recipient_emails: string[]
          sent_at: string | null
        }
        Insert: {
          created_at?: string | null
          email_subject: string
          id?: string
          invoice_id?: string | null
          metadata?: Json | null
          notification_type: string
          org_id: string
          recipient_emails: string[]
          sent_at?: string | null
        }
        Update: {
          created_at?: string | null
          email_subject?: string
          id?: string
          invoice_id?: string | null
          metadata?: Json | null
          notification_type?: string
          org_id?: string
          recipient_emails?: string[]
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_notifications_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "subscription_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_notifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_pricing: {
        Row: {
          auto_topup_amount: number
          auto_topup_enabled: boolean | null
          call_cost_per_call: number | null
          call_cost_per_minute: number
          created_at: string | null
          created_by: string | null
          effective_from: string
          email_cost_per_unit: number
          gst_percentage: number
          id: string
          is_active: boolean | null
          min_wallet_balance: number
          one_time_setup_cost: number
          per_user_monthly_cost: number
          updated_at: string | null
          whatsapp_cost_per_unit: number
        }
        Insert: {
          auto_topup_amount?: number
          auto_topup_enabled?: boolean | null
          call_cost_per_call?: number | null
          call_cost_per_minute?: number
          created_at?: string | null
          created_by?: string | null
          effective_from?: string
          email_cost_per_unit?: number
          gst_percentage?: number
          id?: string
          is_active?: boolean | null
          min_wallet_balance?: number
          one_time_setup_cost?: number
          per_user_monthly_cost?: number
          updated_at?: string | null
          whatsapp_cost_per_unit?: number
        }
        Update: {
          auto_topup_amount?: number
          auto_topup_enabled?: boolean | null
          call_cost_per_call?: number | null
          call_cost_per_minute?: number
          created_at?: string | null
          created_by?: string | null
          effective_from?: string
          email_cost_per_unit?: number
          gst_percentage?: number
          id?: string
          is_active?: boolean | null
          min_wallet_balance?: number
          one_time_setup_cost?: number
          per_user_monthly_cost?: number
          updated_at?: string | null
          whatsapp_cost_per_unit?: number
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_by: string
          assigned_to: string
          completed_at: string | null
          created_at: string | null
          description: string | null
          due_date: string
          id: string
          org_id: string
          priority: string | null
          status: string
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_by: string
          assigned_to: string
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date: string
          id?: string
          org_id: string
          priority?: string | null
          status?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_by?: string
          assigned_to?: string
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string
          id?: string
          org_id?: string
          priority?: string | null
          status?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string | null
          id: string
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          manager_id: string | null
          name: string
          org_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          manager_id?: string | null
          name: string
          org_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          manager_id?: string | null
          name?: string
          org_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_module_usage: {
        Row: {
          created_at: string
          id: string
          last_visited_at: string
          module_icon: string
          module_key: string
          module_name: string
          module_path: string
          org_id: string
          user_id: string
          visit_count: number
        }
        Insert: {
          created_at?: string
          id?: string
          last_visited_at?: string
          module_icon: string
          module_key: string
          module_name: string
          module_path: string
          org_id: string
          user_id: string
          visit_count?: number
        }
        Update: {
          created_at?: string
          id?: string
          last_visited_at?: string
          module_icon?: string
          module_key?: string
          module_name?: string
          module_path?: string
          org_id?: string
          user_id?: string
          visit_count?: number
        }
        Relationships: []
      }
      user_referral_codes: {
        Row: {
          applications_count: number | null
          created_at: string | null
          id: string
          is_active: boolean | null
          org_id: string
          referral_code: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          applications_count?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          org_id: string
          referral_code: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          applications_count?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          org_id?: string
          referral_code?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_referral_codes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          org_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      videokyc_recordings: {
        Row: {
          access_token: string | null
          applicant_email: string | null
          applicant_name: string
          applicant_phone: string | null
          application_id: string
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          id: string
          org_id: string
          recording_url: string | null
          status: string | null
          token_expires_at: string | null
        }
        Insert: {
          access_token?: string | null
          applicant_email?: string | null
          applicant_name: string
          applicant_phone?: string | null
          application_id: string
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          org_id: string
          recording_url?: string | null
          status?: string | null
          token_expires_at?: string | null
        }
        Update: {
          access_token?: string | null
          applicant_email?: string | null
          applicant_name?: string
          applicant_phone?: string | null
          application_id?: string
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          org_id?: string
          recording_url?: string | null
          status?: string | null
          token_expires_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "videokyc_recordings_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videokyc_recordings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          admin_reason: string | null
          amount: number
          balance_after: number
          balance_before: number
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          org_id: string
          payment_transaction_id: string | null
          quantity: number | null
          reference_id: string | null
          reference_type: string | null
          transaction_type: string
          unit_cost: number | null
        }
        Insert: {
          admin_reason?: string | null
          amount: number
          balance_after: number
          balance_before: number
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          org_id: string
          payment_transaction_id?: string | null
          quantity?: number | null
          reference_id?: string | null
          reference_type?: string | null
          transaction_type: string
          unit_cost?: number | null
        }
        Update: {
          admin_reason?: string | null
          amount?: number
          balance_after?: number
          balance_before?: number
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          org_id?: string
          payment_transaction_id?: string | null
          quantity?: number | null
          reference_id?: string | null
          reference_type?: string | null
          transaction_type?: string
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_payment_transaction_id_fkey"
            columns: ["payment_transaction_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_bulk_campaigns: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          failed_count: number
          id: string
          message_content: string
          name: string
          org_id: string
          pending_count: number
          scheduled_at: string | null
          sent_count: number
          started_at: string | null
          status: string
          template_id: string | null
          total_recipients: number
          updated_at: string
          variable_mappings: Json | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          failed_count?: number
          id?: string
          message_content: string
          name: string
          org_id: string
          pending_count?: number
          scheduled_at?: string | null
          sent_count?: number
          started_at?: string | null
          status?: string
          template_id?: string | null
          total_recipients?: number
          updated_at?: string
          variable_mappings?: Json | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          failed_count?: number
          id?: string
          message_content?: string
          name?: string
          org_id?: string
          pending_count?: number
          scheduled_at?: string | null
          sent_count?: number
          started_at?: string | null
          status?: string
          template_id?: string | null
          total_recipients?: number
          updated_at?: string
          variable_mappings?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_bulk_campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "communication_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_campaign_recipients: {
        Row: {
          campaign_id: string
          contact_id: string | null
          created_at: string
          custom_data: Json | null
          error_message: string | null
          id: string
          last_retry_at: string | null
          max_retries: number
          message_id: string | null
          next_retry_at: string | null
          phone_number: string
          retry_count: number
          status: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          contact_id?: string | null
          created_at?: string
          custom_data?: Json | null
          error_message?: string | null
          id?: string
          last_retry_at?: string | null
          max_retries?: number
          message_id?: string | null
          next_retry_at?: string | null
          phone_number: string
          retry_count?: number
          status?: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          contact_id?: string | null
          created_at?: string
          custom_data?: Json | null
          error_message?: string | null
          id?: string
          last_retry_at?: string | null
          max_retries?: number
          message_id?: string | null
          next_retry_at?: string | null
          phone_number?: string
          retry_count?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_bulk_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_campaign_recipients_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_campaign_recipients_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_with_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_campaign_recipients_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          contact_id: string
          conversation_id: string | null
          created_at: string | null
          delivered_at: string | null
          direction: string
          error_message: string | null
          exotel_message_id: string | null
          id: string
          is_read: boolean
          media_type: string | null
          media_url: string | null
          message_content: string
          org_id: string
          phone_number: string
          read_at: string | null
          replied_to_message_id: string | null
          scheduled_at: string | null
          sender_name: string | null
          sent_at: string | null
          sent_by: string | null
          status: string | null
          template_id: string | null
          template_variables: Json | null
        }
        Insert: {
          contact_id: string
          conversation_id?: string | null
          created_at?: string | null
          delivered_at?: string | null
          direction?: string
          error_message?: string | null
          exotel_message_id?: string | null
          id?: string
          is_read?: boolean
          media_type?: string | null
          media_url?: string | null
          message_content: string
          org_id: string
          phone_number: string
          read_at?: string | null
          replied_to_message_id?: string | null
          scheduled_at?: string | null
          sender_name?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string | null
          template_id?: string | null
          template_variables?: Json | null
        }
        Update: {
          contact_id?: string
          conversation_id?: string | null
          created_at?: string | null
          delivered_at?: string | null
          direction?: string
          error_message?: string | null
          exotel_message_id?: string | null
          id?: string
          is_read?: boolean
          media_type?: string | null
          media_url?: string | null
          message_content?: string
          org_id?: string
          phone_number?: string
          read_at?: string | null
          replied_to_message_id?: string | null
          scheduled_at?: string | null
          sender_name?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string | null
          template_id?: string | null
          template_variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_with_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_replied_to_message_id_fkey"
            columns: ["replied_to_message_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "communication_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_settings: {
        Row: {
          created_at: string | null
          exotel_api_key: string | null
          exotel_api_token: string | null
          exotel_sid: string | null
          exotel_subdomain: string | null
          id: string
          is_active: boolean | null
          org_id: string
          updated_at: string | null
          waba_id: string | null
          webhook_secret: string | null
          whatsapp_source_number: string
        }
        Insert: {
          created_at?: string | null
          exotel_api_key?: string | null
          exotel_api_token?: string | null
          exotel_sid?: string | null
          exotel_subdomain?: string | null
          id?: string
          is_active?: boolean | null
          org_id: string
          updated_at?: string | null
          waba_id?: string | null
          webhook_secret?: string | null
          whatsapp_source_number: string
        }
        Update: {
          created_at?: string | null
          exotel_api_key?: string | null
          exotel_api_token?: string | null
          exotel_sid?: string | null
          exotel_subdomain?: string | null
          id?: string
          is_active?: boolean | null
          org_id?: string
          updated_at?: string | null
          waba_id?: string | null
          webhook_secret?: string | null
          whatsapp_source_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      contacts_with_stages: {
        Row: {
          assigned_to: string | null
          company: string | null
          created_at: string | null
          email: string | null
          first_name: string | null
          id: string | null
          job_title: string | null
          last_name: string | null
          org_id: string | null
          phone: string | null
          pipeline_stage_id: string | null
          stage_name: string | null
          stage_order: number | null
          status: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_pipeline_stage_id_fkey"
            columns: ["pipeline_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      aggregate_automation_performance_daily: {
        Args: { _date: string }
        Returns: undefined
      }
      calculate_monthly_amount: { Args: { _org_id: string }; Returns: number }
      can_create_import_job: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      check_and_increment_daily_limit: {
        Args: { _contact_id: string; _max_per_day: number; _org_id: string }
        Returns: boolean
      }
      check_and_update_subscription_status: {
        Args: { _org_id: string }
        Returns: undefined
      }
      check_circular_dependency: {
        Args: { _depends_on_rule_id: string; _rule_id: string }
        Returns: boolean
      }
      check_connector_rate_limit: {
        Args: { _form_id: string; _limit: number }
        Returns: boolean
      }
      check_inactive_contacts: { Args: never; Returns: undefined }
      cleanup_expired_otps: { Args: never; Returns: undefined }
      cleanup_expired_public_otps: { Args: never; Returns: undefined }
      cleanup_orphaned_profile: {
        Args: { user_id: string }
        Returns: undefined
      }
      create_default_call_dispositions: {
        Args: { _org_id: string }
        Returns: undefined
      }
      create_default_pipeline_stages: {
        Args: { _org_id: string }
        Returns: undefined
      }
      deduct_from_wallet: {
        Args: {
          _amount: number
          _org_id: string
          _quantity: number
          _reference_id: string
          _service_type: string
          _unit_cost: number
          _user_id: string
        }
        Returns: Json
      }
      delete_user_data: { Args: { user_email: string }; Returns: undefined }
      designation_has_feature_access: {
        Args: {
          _designation_id: string
          _feature_key: string
          _permission?: string
        }
        Returns: boolean
      }
      generate_loan_application_number: { Args: never; Returns: string }
      generate_referral_code: { Args: { p_user_id: string }; Returns: string }
      generate_webhook_token: { Args: never; Returns: string }
      get_active_pricing: {
        Args: never
        Returns: {
          auto_topup_amount: number
          call_cost_per_call: number
          call_cost_per_minute: number
          email_cost_per_unit: number
          gst_percentage: number
          min_wallet_balance: number
          one_time_setup_cost: number
          per_user_monthly_cost: number
          whatsapp_cost_per_unit: number
        }[]
      }
      get_activity_trends: {
        Args: { p_days?: number; p_org_id: string }
        Returns: {
          activity_count: number
          activity_date: string
          activity_type: string
        }[]
      }
      get_agent_call_performance_report: {
        Args: { p_end_date?: string; p_org_id: string; p_start_date: string }
        Returns: {
          agent_id: string
          agent_name: string
          answered_calls: number
          avg_duration_seconds: number
          disposition_breakdown: Json
          inbound_calls: number
          missed_calls: number
          outbound_calls: number
          total_calls: number
          total_duration_seconds: number
        }[]
      }
      get_dashboard_stats: { Args: { p_org_id: string }; Returns: Json }
      get_demo_stats_this_month: {
        Args: { p_org_id: string }
        Returns: {
          demos_done: number
          demos_upcoming: number
        }[]
      }
      get_next_assignee: { Args: { p_org_id: string }; Returns: string }
      get_optimal_send_time: {
        Args: { _contact_id: string; _default_hour?: number; _org_id: string }
        Returns: Json
      }
      get_org_statistics: { Args: { p_org_id: string }; Returns: Json }
      get_orphaned_profiles: {
        Args: never
        Returns: {
          created_at: string
          email: string
          first_name: string
          last_name: string
          user_id: string
        }[]
      }
      get_pipeline_distribution: {
        Args: { p_org_id: string }
        Returns: {
          contact_count: number
          stage_name: string
        }[]
      }
      get_pipeline_performance_report: {
        Args: { p_org_id: string }
        Returns: {
          contact_count: number
          stage_color: string
          stage_id: string
          stage_name: string
          stage_order: number
        }[]
      }
      get_reporting_chain: {
        Args: { p_designation_id: string }
        Returns: {
          designation_id: string
          level: number
        }[]
      }
      get_rule_execution_order: {
        Args: { _org_id: string }
        Returns: {
          execution_level: number
          rule_id: string
        }[]
      }
      get_sales_performance_report: {
        Args: { p_org_id: string; p_start_date: string }
        Returns: {
          conversion_rate: number
          deals_won: number
          total_calls: number
          total_contacts: number
          total_emails: number
          total_meetings: number
          user_id: string
          user_name: string
        }[]
      }
      get_subordinates: {
        Args: { p_designation_id: string }
        Returns: {
          designation_id: string
          level: number
        }[]
      }
      get_unified_inbox: {
        Args: { p_limit?: number; p_org_id: string }
        Returns: {
          channel: string
          contact_id: string
          contact_name: string
          conversation_id: string
          direction: string
          email_address: string
          id: string
          is_read: boolean
          phone_number: string
          preview: string
          sender_name: string
          sent_at: string
        }[]
      }
      get_user_org_id: { Args: { _user_id: string }; Returns: string }
      get_visible_user_ids: { Args: { _user_id: string }; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_automation_cooldown: {
        Args: { _contact_id: string; _org_id: string; _rule_id: string }
        Returns: undefined
      }
      increment_automation_rule_stats: {
        Args: { _rule_id: string; _stat_type: string }
        Returns: undefined
      }
      increment_campaign_stats: {
        Args: {
          p_campaign_id: string
          p_failed_increment?: number
          p_pending_increment?: number
          p_sent_increment?: number
        }
        Returns: undefined
      }
      increment_email_campaign_stats: {
        Args: {
          p_campaign_id: string
          p_failed_increment?: number
          p_pending_increment?: number
          p_sent_increment?: number
        }
        Returns: undefined
      }
      is_email_suppressed: {
        Args: { _email: string; _org_id: string }
        Returns: boolean
      }
      is_email_unsubscribed: {
        Args: { _email: string; _org_id: string }
        Returns: boolean
      }
      is_feature_enabled_for_org: {
        Args: { _feature_key: string; _org_id: string }
        Returns: boolean
      }
      is_within_business_hours: {
        Args: { _check_time: string; _org_id: string }
        Returns: boolean
      }
      manage_webhook_trigger: {
        Args: { p_action: string; p_operation: string; p_table_name: string }
        Returns: undefined
      }
      mark_automation_conversion: {
        Args: {
          _conversion_type: string
          _conversion_value?: number
          _execution_id: string
        }
        Returns: undefined
      }
      nextval_text: { Args: { seq_name: string }; Returns: string }
      process_time_based_triggers: { Args: never; Returns: undefined }
      record_emi_payment_atomic: {
        Args: {
          p_payment_amount: number
          p_payment_date: string
          p_schedule_id: string
        }
        Returns: {
          new_amount_paid: number
          new_status: string
        }[]
      }
      refresh_contacts_with_stages: { Args: never; Returns: undefined }
      sync_platform_email_list: { Args: never; Returns: undefined }
      transition_loan_stage: {
        Args: {
          p_application_id: string
          p_approved_amount?: number
          p_approved_by?: string
          p_expected_current_stage: string
          p_interest_rate?: number
          p_new_stage: string
          p_new_status?: string
          p_tenure_days?: number
        }
        Returns: boolean
      }
      trigger_retry_failed_whatsapp: { Args: never; Returns: undefined }
      update_lead_score: {
        Args: {
          _contact_id: string
          _org_id: string
          _reason: string
          _score_delta: number
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "admin"
        | "sales_manager"
        | "sales_agent"
        | "support_manager"
        | "support_agent"
        | "analyst"
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
      app_role: [
        "super_admin",
        "admin",
        "sales_manager",
        "sales_agent",
        "support_manager",
        "support_agent",
        "analyst",
      ],
    },
  },
} as const
