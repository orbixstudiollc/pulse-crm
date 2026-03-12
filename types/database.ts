// Auto-generated Supabase types placeholder.
// After running the schema migration, generate real types with:
// npx supabase gen types typescript --project-id YOUR_PROJECT_REF > types/database.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          organization_id: string | null;
          first_name: string | null;
          last_name: string | null;
          email: string;
          phone: string | null;
          job_title: string | null;
          avatar_url: string | null;
          role: string;
          timezone: string;
          date_format: string;
          time_format: string;
          language: string;
          notification_preferences: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          organization_id?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          email: string;
          phone?: string | null;
          job_title?: string | null;
          avatar_url?: string | null;
          role?: string;
          timezone?: string;
          date_format?: string;
          time_format?: string;
          language?: string;
          notification_preferences?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          organization_id?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          email?: string;
          phone?: string | null;
          job_title?: string | null;
          avatar_url?: string | null;
          role?: string;
          timezone?: string;
          date_format?: string;
          time_format?: string;
          language?: string;
          notification_preferences?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      customers: {
        Row: {
          id: string;
          organization_id: string;
          created_by: string | null;
          first_name: string;
          last_name: string;
          email: string;
          phone: string | null;
          avatar_url: string | null;
          status: Database["public"]["Enums"]["customer_status"];
          plan: Database["public"]["Enums"]["customer_plan"];
          mrr: number;
          health_score: number;
          lifetime_value: number;
          tenure: number;
          last_contact: string | null;
          company: string | null;
          job_title: string | null;
          industry: string | null;
          company_size: string | null;
          website: string | null;
          street_address: string | null;
          city: string | null;
          state: string | null;
          postal_code: string | null;
          country: string;
          timezone: string | null;
          customer_since: string | null;
          renewal_date: string | null;
          tags: string[];
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          created_by?: string | null;
          first_name: string;
          last_name: string;
          email: string;
          phone?: string | null;
          avatar_url?: string | null;
          status?: Database["public"]["Enums"]["customer_status"];
          plan?: Database["public"]["Enums"]["customer_plan"];
          mrr?: number;
          health_score?: number;
          lifetime_value?: number;
          tenure?: number;
          last_contact?: string | null;
          company?: string | null;
          job_title?: string | null;
          industry?: string | null;
          company_size?: string | null;
          website?: string | null;
          street_address?: string | null;
          city?: string | null;
          state?: string | null;
          postal_code?: string | null;
          country?: string;
          timezone?: string | null;
          customer_since?: string | null;
          renewal_date?: string | null;
          tags?: string[];
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          first_name?: string;
          last_name?: string;
          email?: string;
          phone?: string | null;
          avatar_url?: string | null;
          status?: Database["public"]["Enums"]["customer_status"];
          plan?: Database["public"]["Enums"]["customer_plan"];
          mrr?: number;
          health_score?: number;
          lifetime_value?: number;
          tenure?: number;
          last_contact?: string | null;
          company?: string | null;
          job_title?: string | null;
          industry?: string | null;
          company_size?: string | null;
          website?: string | null;
          street_address?: string | null;
          city?: string | null;
          state?: string | null;
          postal_code?: string | null;
          country?: string;
          timezone?: string | null;
          customer_since?: string | null;
          renewal_date?: string | null;
          tags?: string[];
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      customer_notes: {
        Row: {
          id: string;
          customer_id: string;
          author_id: string | null;
          author_name: string;
          content: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          author_id?: string | null;
          author_name: string;
          content: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          content?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      customer_activities: {
        Row: {
          id: string;
          customer_id: string;
          type: string;
          title: string;
          description: string | null;
          badge_label: string | null;
          badge_variant: string | null;
          meta: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          type: string;
          title: string;
          description?: string | null;
          badge_label?: string | null;
          badge_variant?: string | null;
          meta?: string | null;
          created_at?: string;
        };
        Update: {
          type?: string;
          title?: string;
          description?: string | null;
          badge_label?: string | null;
          badge_variant?: string | null;
          meta?: string | null;
        };
        Relationships: [];
      };
      customer_custom_fields: {
        Row: {
          id: string;
          customer_id: string;
          name: string;
          value: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          name: string;
          value?: string | null;
          created_at?: string;
        };
        Update: {
          name?: string;
          value?: string | null;
        };
        Relationships: [];
      };
      leads: {
        Row: {
          id: string;
          organization_id: string;
          created_by: string | null;
          name: string;
          email: string;
          company: string | null;
          phone: string | null;
          linkedin: string | null;
          location: string | null;
          employees: string | null;
          website: string | null;
          industry: string | null;
          status: Database["public"]["Enums"]["lead_status"];
          source: Database["public"]["Enums"]["lead_source"];
          estimated_value: number;
          score: number;
          win_probability: number;
          days_in_pipeline: number;
          score_breakdown: Json | null;
          last_scored_at: string | null;
          engagement_score: number;
          icp_match_score: number | null;
          icp_profile_id: string | null;
          icp_match_breakdown: Json | null;
          qualification_data: Json | null;
          qualification_grade: string | null;
          qualification_score: number | null;
          next_followup: string | null;
          followup_note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          created_by?: string | null;
          name: string;
          email: string;
          company?: string | null;
          phone?: string | null;
          linkedin?: string | null;
          location?: string | null;
          employees?: string | null;
          website?: string | null;
          industry?: string | null;
          status?: Database["public"]["Enums"]["lead_status"];
          source?: Database["public"]["Enums"]["lead_source"];
          estimated_value?: number;
          score?: number;
          win_probability?: number;
          days_in_pipeline?: number;
          score_breakdown?: Json | null;
          last_scored_at?: string | null;
          engagement_score?: number;
          icp_match_score?: number | null;
          icp_profile_id?: string | null;
          icp_match_breakdown?: Json | null;
          qualification_data?: Json | null;
          qualification_grade?: string | null;
          qualification_score?: number | null;
          next_followup?: string | null;
          followup_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          email?: string;
          company?: string | null;
          phone?: string | null;
          linkedin?: string | null;
          location?: string | null;
          employees?: string | null;
          website?: string | null;
          industry?: string | null;
          status?: Database["public"]["Enums"]["lead_status"];
          source?: Database["public"]["Enums"]["lead_source"];
          estimated_value?: number;
          score?: number;
          win_probability?: number;
          days_in_pipeline?: number;
          score_breakdown?: Json | null;
          last_scored_at?: string | null;
          engagement_score?: number;
          icp_match_score?: number | null;
          icp_profile_id?: string | null;
          icp_match_breakdown?: Json | null;
          qualification_data?: Json | null;
          qualification_grade?: string | null;
          qualification_score?: number | null;
          next_followup?: string | null;
          followup_note?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      lead_notes: {
        Row: {
          id: string;
          lead_id: string;
          author_id: string | null;
          author_name: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          lead_id: string;
          author_id?: string | null;
          author_name: string;
          content: string;
          created_at?: string;
        };
        Update: {
          content?: string;
        };
        Relationships: [];
      };
      lead_activities: {
        Row: {
          id: string;
          lead_id: string;
          type: string;
          title: string;
          description: string | null;
          badge_label: string | null;
          badge_variant: string | null;
          meta: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          lead_id: string;
          type: string;
          title: string;
          description?: string | null;
          badge_label?: string | null;
          badge_variant?: string | null;
          meta?: string | null;
          created_at?: string;
        };
        Update: {
          type?: string;
          title?: string;
          description?: string | null;
        };
        Relationships: [];
      };
      deals: {
        Row: {
          id: string;
          organization_id: string;
          created_by: string | null;
          customer_id: string | null;
          name: string;
          company: string | null;
          value: number;
          probability: number;
          stage: Database["public"]["Enums"]["deal_stage"];
          close_date: string | null;
          owner_id: string | null;
          days_in_stage: number;
          days_to_close: number;
          last_activity: string | null;
          contact_name: string | null;
          contact_email: string | null;
          contact_avatar: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          created_by?: string | null;
          customer_id?: string | null;
          name: string;
          company?: string | null;
          value?: number;
          probability?: number;
          stage?: Database["public"]["Enums"]["deal_stage"];
          close_date?: string | null;
          owner_id?: string | null;
          days_in_stage?: number;
          days_to_close?: number;
          last_activity?: string | null;
          contact_name?: string | null;
          contact_email?: string | null;
          contact_avatar?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          customer_id?: string | null;
          name?: string;
          company?: string | null;
          value?: number;
          probability?: number;
          stage?: Database["public"]["Enums"]["deal_stage"];
          close_date?: string | null;
          owner_id?: string | null;
          days_in_stage?: number;
          days_to_close?: number;
          last_activity?: string | null;
          contact_name?: string | null;
          contact_email?: string | null;
          contact_avatar?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      deal_notes: {
        Row: {
          id: string;
          deal_id: string;
          author_id: string | null;
          author_name: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          deal_id: string;
          author_id?: string | null;
          author_name: string;
          content: string;
          created_at?: string;
        };
        Update: {
          content?: string;
        };
        Relationships: [];
      };
      deal_activities: {
        Row: {
          id: string;
          deal_id: string;
          type: string;
          title: string;
          description: string | null;
          badge_label: string | null;
          badge_variant: string | null;
          meta: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          deal_id: string;
          type: string;
          title: string;
          description?: string | null;
          badge_label?: string | null;
          badge_variant?: string | null;
          meta?: string | null;
          created_at?: string;
        };
        Update: {
          type?: string;
          title?: string;
          description?: string | null;
        };
        Relationships: [];
      };
      activities: {
        Row: {
          id: string;
          organization_id: string;
          created_by: string | null;
          type: Database["public"]["Enums"]["activity_type"];
          title: string;
          description: string | null;
          status: Database["public"]["Enums"]["activity_status"];
          date: string | null;
          time: string | null;
          assignee: string | null;
          related_type: Database["public"]["Enums"]["related_entity_type"] | null;
          related_name: string | null;
          related_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          created_by?: string | null;
          type: Database["public"]["Enums"]["activity_type"];
          title: string;
          description?: string | null;
          status?: Database["public"]["Enums"]["activity_status"];
          date?: string | null;
          time?: string | null;
          assignee?: string | null;
          related_type?: Database["public"]["Enums"]["related_entity_type"] | null;
          related_name?: string | null;
          related_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          type?: Database["public"]["Enums"]["activity_type"];
          title?: string;
          description?: string | null;
          status?: Database["public"]["Enums"]["activity_status"];
          date?: string | null;
          time?: string | null;
          assignee?: string | null;
          related_type?: Database["public"]["Enums"]["related_entity_type"] | null;
          related_name?: string | null;
          related_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      calendar_events: {
        Row: {
          id: string;
          organization_id: string;
          created_by: string | null;
          title: string;
          description: string | null;
          date: string;
          start_time: string | null;
          end_time: string | null;
          type: string;
          status: string;
          related_type: Database["public"]["Enums"]["related_entity_type"] | null;
          related_name: string | null;
          related_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          created_by?: string | null;
          title: string;
          description?: string | null;
          date: string;
          start_time?: string | null;
          end_time?: string | null;
          type?: string;
          status?: string;
          related_type?: Database["public"]["Enums"]["related_entity_type"] | null;
          related_name?: string | null;
          related_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          description?: string | null;
          date?: string;
          start_time?: string | null;
          end_time?: string | null;
          type?: string;
          status?: string;
          related_type?: Database["public"]["Enums"]["related_entity_type"] | null;
          related_name?: string | null;
          related_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      scoring_profiles: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          weight_company_size: number;
          weight_industry_fit: number;
          weight_engagement: number;
          weight_source_quality: number;
          weight_budget: number;
          target_industries: string[];
          target_company_sizes: string[];
          source_rankings: Json;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name?: string;
          weight_company_size?: number;
          weight_industry_fit?: number;
          weight_engagement?: number;
          weight_source_quality?: number;
          weight_budget?: number;
          target_industries?: string[];
          target_company_sizes?: string[];
          source_rankings?: Json;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          weight_company_size?: number;
          weight_industry_fit?: number;
          weight_engagement?: number;
          weight_source_quality?: number;
          weight_budget?: number;
          target_industries?: string[];
          target_company_sizes?: string[];
          source_rankings?: Json;
          is_default?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      lead_score_history: {
        Row: {
          id: string;
          lead_id: string;
          score: number;
          breakdown: Json;
          scored_at: string;
        };
        Insert: {
          id?: string;
          lead_id: string;
          score: number;
          breakdown?: Json;
          scored_at?: string;
        };
        Update: {
          score?: number;
          breakdown?: Json;
        };
        Relationships: [];
      };
      icp_profiles: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          description: string | null;
          criteria: Json;
          weights: Json;
          buyer_personas: Json;
          color: string | null;
          is_primary: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          description?: string | null;
          criteria?: Json;
          weights?: Json;
          buyer_personas?: Json;
          color?: string | null;
          is_primary?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          criteria?: Json;
          weights?: Json;
          buyer_personas?: Json;
          color?: string | null;
          is_primary?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      sequences: {
        Row: {
          id: string;
          organization_id: string;
          created_by: string | null;
          name: string;
          description: string | null;
          status: Database["public"]["Enums"]["sequence_status"];
          category: string;
          total_steps: number;
          total_enrolled: number;
          reply_rate: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          created_by?: string | null;
          name: string;
          description?: string | null;
          status?: Database["public"]["Enums"]["sequence_status"];
          category?: string;
          total_steps?: number;
          total_enrolled?: number;
          reply_rate?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          status?: Database["public"]["Enums"]["sequence_status"];
          category?: string;
          total_steps?: number;
          total_enrolled?: number;
          reply_rate?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      sequence_steps: {
        Row: {
          id: string;
          sequence_id: string;
          step_order: number;
          step_type: string;
          delay_days: number;
          subject: string | null;
          body: string | null;
          channel: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sequence_id: string;
          step_order?: number;
          step_type?: string;
          delay_days?: number;
          subject?: string | null;
          body?: string | null;
          channel?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          step_order?: number;
          step_type?: string;
          delay_days?: number;
          subject?: string | null;
          body?: string | null;
          channel?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      email_templates: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          subject: string;
          body: string;
          category: string;
          merge_fields: string[];
          usage_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          subject: string;
          body: string;
          category?: string;
          merge_fields?: string[];
          usage_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          subject?: string;
          body?: string;
          category?: string;
          merge_fields?: string[];
          usage_count?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      sequence_enrollments: {
        Row: {
          id: string;
          sequence_id: string;
          lead_id: string;
          current_step: number;
          status: Database["public"]["Enums"]["enrollment_status"];
          enrolled_at: string;
          completed_at: string | null;
          paused_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sequence_id: string;
          lead_id: string;
          current_step?: number;
          status?: Database["public"]["Enums"]["enrollment_status"];
          enrolled_at?: string;
          completed_at?: string | null;
          paused_at?: string | null;
          updated_at?: string;
        };
        Update: {
          current_step?: number;
          status?: Database["public"]["Enums"]["enrollment_status"];
          completed_at?: string | null;
          paused_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      sequence_events: {
        Row: {
          id: string;
          enrollment_id: string;
          step_id: string | null;
          event_type: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          enrollment_id: string;
          step_id?: string | null;
          event_type: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          event_type?: string;
          metadata?: Json;
        };
        Relationships: [];
      };
      competitors: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          website: string | null;
          category: string;
          description: string | null;
          strengths: string[];
          weaknesses: string[];
          pricing: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          website?: string | null;
          category?: string;
          description?: string | null;
          strengths?: string[];
          weaknesses?: string[];
          pricing?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          website?: string | null;
          category?: string;
          description?: string | null;
          strengths?: string[];
          weaknesses?: string[];
          pricing?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      battle_cards: {
        Row: {
          id: string;
          competitor_id: string;
          their_strengths: string[];
          their_weaknesses: string[];
          our_advantages: string[];
          switching_costs: Json;
          switching_triggers: string[];
          landmine_questions: string[];
          positioning_statement: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          competitor_id: string;
          their_strengths?: string[];
          their_weaknesses?: string[];
          our_advantages?: string[];
          switching_costs?: Json;
          switching_triggers?: string[];
          landmine_questions?: string[];
          positioning_statement?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          their_strengths?: string[];
          their_weaknesses?: string[];
          our_advantages?: string[];
          switching_costs?: Json;
          switching_triggers?: string[];
          landmine_questions?: string[];
          positioning_statement?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      lead_competitors: {
        Row: {
          id: string;
          lead_id: string;
          competitor_id: string;
          confidence: string;
          evidence: string | null;
          detected_at: string;
        };
        Insert: {
          id?: string;
          lead_id: string;
          competitor_id: string;
          confidence?: string;
          evidence?: string | null;
          detected_at?: string;
        };
        Update: {
          confidence?: string;
          evidence?: string | null;
        };
        Relationships: [];
      };
      objection_playbook: {
        Row: {
          id: string;
          organization_id: string;
          category: string;
          objection_text: string;
          hidden_meaning: string | null;
          ffr_response: string | null;
          abc_response: string | null;
          follow_up_question: string | null;
          proof_point: string | null;
          walk_away_criteria: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          category?: string;
          objection_text: string;
          hidden_meaning?: string | null;
          ffr_response?: string | null;
          abc_response?: string | null;
          follow_up_question?: string | null;
          proof_point?: string | null;
          walk_away_criteria?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          category?: string;
          objection_text?: string;
          hidden_meaning?: string | null;
          ffr_response?: string | null;
          abc_response?: string | null;
          follow_up_question?: string | null;
          proof_point?: string | null;
          walk_away_criteria?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      proposals: {
        Row: {
          id: string;
          organization_id: string;
          deal_id: string | null;
          title: string;
          status: string;
          content: Json;
          pricing_tiers: Json;
          valid_until: string | null;
          sent_at: string | null;
          viewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          deal_id?: string | null;
          title: string;
          status?: string;
          content?: Json;
          pricing_tiers?: Json;
          valid_until?: string | null;
          sent_at?: string | null;
          viewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          deal_id?: string | null;
          title?: string;
          status?: string;
          content?: Json;
          pricing_tiers?: Json;
          valid_until?: string | null;
          sent_at?: string | null;
          viewed_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      contacts: {
        Row: {
          id: string;
          organization_id: string;
          lead_id: string | null;
          customer_id: string | null;
          name: string;
          title: string | null;
          email: string | null;
          phone: string | null;
          linkedin: string | null;
          buying_role: string;
          influence_level: string;
          personalization_anchors: Json;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          lead_id?: string | null;
          customer_id?: string | null;
          name: string;
          title?: string | null;
          email?: string | null;
          phone?: string | null;
          linkedin?: string | null;
          buying_role?: string;
          influence_level?: string;
          personalization_anchors?: Json;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          lead_id?: string | null;
          customer_id?: string | null;
          name?: string;
          title?: string | null;
          email?: string | null;
          phone?: string | null;
          linkedin?: string | null;
          buying_role?: string;
          influence_level?: string;
          personalization_anchors?: Json;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      copy_templates: {
        Row: {
          id: string;
          organization_id: string;
          category: string;
          name: string;
          headline: string | null;
          body: string | null;
          cta: string | null;
          tags: string[];
          usage_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          category?: string;
          name: string;
          headline?: string | null;
          body?: string | null;
          cta?: string | null;
          tags?: string[];
          usage_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          category?: string;
          name?: string;
          headline?: string | null;
          body?: string | null;
          cta?: string | null;
          tags?: string[];
          usage_count?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_integrations: {
        Row: {
          id: string;
          user_id: string;
          integration_name: string;
          connected: boolean;
          config: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          integration_name: string;
          connected?: boolean;
          config?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          connected?: boolean;
          config?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      ai_settings: {
        Row: {
          id: string;
          organization_id: string;
          api_key: string | null;
          default_model: string;
          feature_lead_scoring: boolean;
          feature_icp_matching: boolean;
          feature_outreach: boolean;
          feature_proposals: boolean;
          feature_meetings: boolean;
          feature_analytics: boolean;
          feature_competitors: boolean;
          feature_objections: boolean;
          feature_chat: boolean;
          autonomy_lead_scoring: string;
          autonomy_icp_matching: string;
          autonomy_outreach: string;
          autonomy_proposals: string;
          autonomy_meetings: string;
          autonomy_analytics: string;
          autonomy_competitors: string;
          autonomy_objections: string;
          tokens_used_today: number;
          tokens_used_month: number;
          daily_token_limit: number;
          monthly_token_limit: number;
          last_token_reset_daily: string;
          last_token_reset_monthly: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          api_key?: string | null;
          default_model?: string;
          feature_lead_scoring?: boolean;
          feature_icp_matching?: boolean;
          feature_outreach?: boolean;
          feature_proposals?: boolean;
          feature_meetings?: boolean;
          feature_analytics?: boolean;
          feature_competitors?: boolean;
          feature_objections?: boolean;
          feature_chat?: boolean;
          autonomy_lead_scoring?: string;
          autonomy_icp_matching?: string;
          autonomy_outreach?: string;
          autonomy_proposals?: string;
          autonomy_meetings?: string;
          autonomy_analytics?: string;
          autonomy_competitors?: string;
          autonomy_objections?: string;
          tokens_used_today?: number;
          tokens_used_month?: number;
          daily_token_limit?: number;
          monthly_token_limit?: number;
          last_token_reset_daily?: string;
          last_token_reset_monthly?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          api_key?: string | null;
          default_model?: string;
          feature_lead_scoring?: boolean;
          feature_icp_matching?: boolean;
          feature_outreach?: boolean;
          feature_proposals?: boolean;
          feature_meetings?: boolean;
          feature_analytics?: boolean;
          feature_competitors?: boolean;
          feature_objections?: boolean;
          feature_chat?: boolean;
          autonomy_lead_scoring?: string;
          autonomy_icp_matching?: string;
          autonomy_outreach?: string;
          autonomy_proposals?: string;
          autonomy_meetings?: string;
          autonomy_analytics?: string;
          autonomy_competitors?: string;
          autonomy_objections?: string;
          tokens_used_today?: number;
          tokens_used_month?: number;
          daily_token_limit?: number;
          monthly_token_limit?: number;
          last_token_reset_daily?: string;
          last_token_reset_monthly?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ai_usage_log: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          feature: string;
          model: string;
          input_tokens: number;
          output_tokens: number;
          total_tokens: number;
          duration_ms: number;
          success: boolean;
          error_message: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          feature: string;
          model: string;
          input_tokens?: number;
          output_tokens?: number;
          total_tokens?: number;
          duration_ms?: number;
          success?: boolean;
          error_message?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          feature?: string;
          model?: string;
          input_tokens?: number;
          output_tokens?: number;
          total_tokens?: number;
          duration_ms?: number;
          success?: boolean;
          error_message?: string | null;
          metadata?: Json;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      customer_status: "active" | "pending" | "inactive";
      customer_plan: "enterprise" | "pro" | "starter" | "free";
      lead_status: "hot" | "warm" | "cold";
      lead_source:
        | "Website"
        | "Referral"
        | "LinkedIn"
        | "Event"
        | "Google Ads"
        | "Cold Call";
      deal_stage:
        | "discovery"
        | "proposal"
        | "negotiation"
        | "closed_won"
        | "closed_lost";
      activity_type: "call" | "meeting" | "task" | "email" | "note";
      activity_status: "completed" | "scheduled" | "pending" | "cancelled";
      related_entity_type: "deal" | "customer" | "lead";
      sequence_status: "draft" | "active" | "paused" | "archived";
      enrollment_status: "active" | "paused" | "completed" | "replied" | "bounced" | "unsubscribed";
    };
    CompositeTypes: Record<string, never>;
  };
};

// Convenience type aliases
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type InsertTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type UpdateTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];
