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
      advisor_notes: {
        Row: {
          author_id: string
          body: string | null
          created_at: string
          id: string
          pinned: boolean
          subject: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body?: string | null
          created_at?: string
          id?: string
          pinned?: boolean
          subject: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string | null
          created_at?: string
          id?: string
          pinned?: boolean
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      advisor_resources: {
        Row: {
          category: string
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          description: string | null
          display_order: number
          id: string
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          category: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          title: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          category?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          title?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      announcements: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          pinned: boolean
          title: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          pinned?: boolean
          title: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          pinned?: boolean
          title?: string
        }
        Relationships: []
      }
      ask_nexus_query_log: {
        Row: {
          created_at: string
          id: string
          query_key: string
          result_count: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          query_key: string
          result_count?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          query_key?: string
          result_count?: number | null
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json | null
          target_id: string | null
          target_type: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      availability_windows: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          preference_weight: number
          start_time: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          preference_weight?: number
          start_time: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          preference_weight?: number
          start_time?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_windows_user_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      badges: {
        Row: {
          created_at: string
          criteria: string | null
          description: string | null
          icon: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          criteria?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          criteria?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      capacity_allocations: {
        Row: {
          cohort_id: string
          competition_pct: number
          contract_pct: number
          created_at: string
          effective_date: string
          id: string
          notes: string | null
          purpose_pct: number
          set_by: string
        }
        Insert: {
          cohort_id: string
          competition_pct?: number
          contract_pct?: number
          created_at?: string
          effective_date?: string
          id?: string
          notes?: string | null
          purpose_pct?: number
          set_by: string
        }
        Update: {
          cohort_id?: string
          competition_pct?: number
          contract_pct?: number
          created_at?: string
          effective_date?: string
          id?: string
          notes?: string | null
          purpose_pct?: number
          set_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "capacity_allocations_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_members: {
        Row: {
          channel_id: string
          id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          channel_id: string
          id?: string
          joined_at?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_members_user_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      channels: {
        Row: {
          channel_kind: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_org_wide: boolean
          name: string
          project_group_id: string | null
          project_id: string | null
        }
        Insert: {
          channel_kind?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_org_wide?: boolean
          name: string
          project_group_id?: string | null
          project_id?: string | null
        }
        Update: {
          channel_kind?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_org_wide?: boolean
          name?: string
          project_group_id?: string | null
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channels_project_group_id_fkey"
            columns: ["project_group_id"]
            isOneToOne: false
            referencedRelation: "project_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channels_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      chapters: {
        Row: {
          city: string | null
          created_at: string
          founded_at: string | null
          id: string
          name: string
          slug: string
          state: string | null
          status: string
          university: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          founded_at?: string | null
          id?: string
          name: string
          slug: string
          state?: string | null
          status?: string
          university?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          founded_at?: string | null
          id?: string
          name?: string
          slug?: string
          state?: string | null
          status?: string
          university?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      client_contacts: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_primary: boolean
          name: string
          org_id: string | null
          phone: string | null
          project_id: string
          role_title: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name: string
          org_id?: string | null
          phone?: string | null
          project_id: string
          role_title?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name?: string
          org_id?: string | null
          phone?: string | null
          project_id?: string
          role_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_contacts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      cohort_memberships: {
        Row: {
          cohort_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          cohort_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          cohort_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cohort_memberships_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cohort_memberships_user_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      cohort_roster: {
        Row: {
          cohort_name: string
          created_at: string
          email: string | null
          full_name: string
          id: string
          identity_status: string
          matched_at: string | null
          matched_user_id: string | null
          role: string
          title: string | null
        }
        Insert: {
          cohort_name: string
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          identity_status?: string
          matched_at?: string | null
          matched_user_id?: string | null
          role?: string
          title?: string | null
        }
        Update: {
          cohort_name?: string
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          identity_status?: string
          matched_at?: string | null
          matched_user_id?: string | null
          role?: string
          title?: string | null
        }
        Relationships: []
      }
      cohorts: {
        Row: {
          chapter_id: string | null
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
        }
        Insert: {
          chapter_id?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
        }
        Update: {
          chapter_id?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "cohorts_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_applications: {
        Row: {
          applicant_email: string
          applicant_name: string
          competition_id: string
          created_at: string
          id: string
          status: string
          submission_notes: string | null
          submission_url: string | null
        }
        Insert: {
          applicant_email: string
          applicant_name: string
          competition_id: string
          created_at?: string
          id?: string
          status?: string
          submission_notes?: string | null
          submission_url?: string | null
        }
        Update: {
          applicant_email?: string
          applicant_name?: string
          competition_id?: string
          created_at?: string
          id?: string
          status?: string
          submission_notes?: string | null
          submission_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competition_applications_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      competitions: {
        Row: {
          application_deadline: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_public: boolean
          judging_end: string | null
          judging_start: string | null
          results_published: boolean
          title: string
        }
        Insert: {
          application_deadline?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_public?: boolean
          judging_end?: string | null
          judging_start?: string | null
          results_published?: boolean
          title: string
        }
        Update: {
          application_deadline?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_public?: boolean
          judging_end?: string | null
          judging_start?: string | null
          results_published?: boolean
          title?: string
        }
        Relationships: []
      }
      course_progress: {
        Row: {
          certified_at: string | null
          completed: boolean
          completed_lessons: string[] | null
          course_id: string
          id: string
          quiz_scores: Json | null
          started_at: string
          user_id: string
        }
        Insert: {
          certified_at?: string | null
          completed?: boolean
          completed_lessons?: string[] | null
          course_id: string
          id?: string
          quiz_scores?: Json | null
          started_at?: string
          user_id: string
        }
        Update: {
          certified_at?: string | null
          completed?: boolean
          completed_lessons?: string[] | null
          course_id?: string
          id?: string
          quiz_scores?: Json | null
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_progress_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_required: boolean
          required_for_roles: Database["public"]["Enums"]["app_role"][] | null
          title: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_required?: boolean
          required_for_roles?: Database["public"]["Enums"]["app_role"][] | null
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_required?: boolean
          required_for_roles?: Database["public"]["Enums"]["app_role"][] | null
          title?: string
        }
        Relationships: []
      }
      decisions: {
        Row: {
          affects: string[] | null
          alternatives_considered: string | null
          category: string
          decided_at: string
          decided_by: string
          id: string
          project_id: string
          rationale: string | null
          reference_links: string | null
          status: string
          tags: string[] | null
          title: string
        }
        Insert: {
          affects?: string[] | null
          alternatives_considered?: string | null
          category?: string
          decided_at?: string
          decided_by: string
          id?: string
          project_id: string
          rationale?: string | null
          reference_links?: string | null
          status?: string
          tags?: string[] | null
          title: string
        }
        Update: {
          affects?: string[] | null
          alternatives_considered?: string | null
          category?: string
          decided_at?: string
          decided_by?: string
          id?: string
          project_id?: string
          rationale?: string | null
          reference_links?: string | null
          status?: string
          tags?: string[] | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "decisions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      deliverable_review_events: {
        Row: {
          actor_id: string
          created_at: string
          deliverable_id: string
          event_type: string
          file_url: string | null
          from_status: string | null
          id: string
          project_id: string
          reason: string | null
          to_status: string | null
          version: number | null
        }
        Insert: {
          actor_id: string
          created_at?: string
          deliverable_id: string
          event_type: string
          file_url?: string | null
          from_status?: string | null
          id?: string
          project_id: string
          reason?: string | null
          to_status?: string | null
          version?: number | null
        }
        Update: {
          actor_id?: string
          created_at?: string
          deliverable_id?: string
          event_type?: string
          file_url?: string | null
          from_status?: string | null
          id?: string
          project_id?: string
          reason?: string | null
          to_status?: string | null
          version?: number | null
        }
        Relationships: []
      }
      deliverables: {
        Row: {
          advisor_review_required: boolean
          approval_required: boolean
          approval_status: Database["public"]["Enums"]["approval_status"]
          approved: boolean
          approved_at: string | null
          approved_by: string | null
          client_visible: boolean
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          engagement_type: string | null
          file_url: string | null
          id: string
          milestone_id: string | null
          owner_id: string | null
          project_id: string
          required: boolean
          stage_id: string | null
          submitter_group_id: string | null
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          advisor_review_required?: boolean
          approval_required?: boolean
          approval_status?: Database["public"]["Enums"]["approval_status"]
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          client_visible?: boolean
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          engagement_type?: string | null
          file_url?: string | null
          id?: string
          milestone_id?: string | null
          owner_id?: string | null
          project_id: string
          required?: boolean
          stage_id?: string | null
          submitter_group_id?: string | null
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          advisor_review_required?: boolean
          approval_required?: boolean
          approval_status?: Database["public"]["Enums"]["approval_status"]
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          client_visible?: boolean
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          engagement_type?: string | null
          file_url?: string | null
          id?: string
          milestone_id?: string | null
          owner_id?: string | null
          project_id?: string
          required?: boolean
          stage_id?: string | null
          submitter_group_id?: string | null
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "deliverables_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverables_owner_profile_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "deliverables_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverables_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "project_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverables_submitter_group_id_fkey"
            columns: ["submitter_group_id"]
            isOneToOne: false
            referencedRelation: "project_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          author_id: string
          cohort_id: string | null
          content: string | null
          created_at: string
          doc_type: string
          folder_id: string | null
          id: string
          mock_project_id: string | null
          project_id: string | null
          title: string
          updated_at: string
          version: number
          visibility: string
        }
        Insert: {
          author_id: string
          cohort_id?: string | null
          content?: string | null
          created_at?: string
          doc_type?: string
          folder_id?: string | null
          id?: string
          mock_project_id?: string | null
          project_id?: string | null
          title: string
          updated_at?: string
          version?: number
          visibility?: string
        }
        Update: {
          author_id?: string
          cohort_id?: string | null
          content?: string | null
          created_at?: string
          doc_type?: string
          folder_id?: string | null
          id?: string
          mock_project_id?: string | null
          project_id?: string | null
          title?: string
          updated_at?: string
          version?: number
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_mock_project_id_fkey"
            columns: ["mock_project_id"]
            isOneToOne: false
            referencedRelation: "mock_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      drill_ai_feedback: {
        Row: {
          attempt_id: string
          created_at: string
          drill_id: string
          id: string
          improvements: string[]
          next_skill: string | null
          raw_response: Json | null
          score_band: string
          strengths: string[]
          user_id: string
        }
        Insert: {
          attempt_id: string
          created_at?: string
          drill_id: string
          id?: string
          improvements?: string[]
          next_skill?: string | null
          raw_response?: Json | null
          score_band: string
          strengths?: string[]
          user_id: string
        }
        Update: {
          attempt_id?: string
          created_at?: string
          drill_id?: string
          id?: string
          improvements?: string[]
          next_skill?: string | null
          raw_response?: Json | null
          score_band?: string
          strengths?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "drill_ai_feedback_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "drill_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drill_ai_feedback_drill_id_fkey"
            columns: ["drill_id"]
            isOneToOne: false
            referencedRelation: "drills"
            referencedColumns: ["id"]
          },
        ]
      }
      drill_attempts: {
        Row: {
          attempted_at: string
          drill_id: string
          id: string
          is_correct: boolean | null
          response: Json | null
          self_score: number | null
          time_spent_seconds: number | null
          user_id: string
          xp_earned: number
        }
        Insert: {
          attempted_at?: string
          drill_id: string
          id?: string
          is_correct?: boolean | null
          response?: Json | null
          self_score?: number | null
          time_spent_seconds?: number | null
          user_id: string
          xp_earned?: number
        }
        Update: {
          attempted_at?: string
          drill_id?: string
          id?: string
          is_correct?: boolean | null
          response?: Json | null
          self_score?: number | null
          time_spent_seconds?: number | null
          user_id?: string
          xp_earned?: number
        }
        Relationships: [
          {
            foreignKeyName: "drill_attempts_drill_id_fkey"
            columns: ["drill_id"]
            isOneToOne: false
            referencedRelation: "drills"
            referencedColumns: ["id"]
          },
        ]
      }
      drill_generation_jobs: {
        Row: {
          category: string
          cohort: Database["public"]["Enums"]["drill_cohort"]
          completed_at: string | null
          count_requested: number
          created_at: string
          difficulty: Database["public"]["Enums"]["drill_difficulty"]
          drafts_created: number
          drill_type: Database["public"]["Enums"]["drill_type"]
          error_message: string | null
          id: string
          requested_by: string
          status: string
        }
        Insert: {
          category: string
          cohort: Database["public"]["Enums"]["drill_cohort"]
          completed_at?: string | null
          count_requested?: number
          created_at?: string
          difficulty: Database["public"]["Enums"]["drill_difficulty"]
          drafts_created?: number
          drill_type: Database["public"]["Enums"]["drill_type"]
          error_message?: string | null
          id?: string
          requested_by: string
          status?: string
        }
        Update: {
          category?: string
          cohort?: Database["public"]["Enums"]["drill_cohort"]
          completed_at?: string | null
          count_requested?: number
          created_at?: string
          difficulty?: Database["public"]["Enums"]["drill_difficulty"]
          drafts_created?: number
          drill_type?: Database["public"]["Enums"]["drill_type"]
          error_message?: string | null
          id?: string
          requested_by?: string
          status?: string
        }
        Relationships: []
      }
      drills: {
        Row: {
          ai_feedback_enabled: boolean
          category: string
          cohort: Database["public"]["Enums"]["drill_cohort"]
          correct_answer: Json | null
          created_at: string
          created_by: string | null
          difficulty: Database["public"]["Enums"]["drill_difficulty"]
          drill_type: Database["public"]["Enums"]["drill_type"]
          estimated_minutes: number
          id: string
          model_answer: string | null
          options: Json | null
          prompt: string
          reviewed_at: string | null
          reviewed_by: string | null
          rubric: string | null
          scenario: string | null
          source: Database["public"]["Enums"]["drill_source"]
          status: Database["public"]["Enums"]["drill_status"]
          tags: string[] | null
          title: string
          updated_at: string
          why_it_matters: string | null
          xp_reward: number
        }
        Insert: {
          ai_feedback_enabled?: boolean
          category: string
          cohort: Database["public"]["Enums"]["drill_cohort"]
          correct_answer?: Json | null
          created_at?: string
          created_by?: string | null
          difficulty?: Database["public"]["Enums"]["drill_difficulty"]
          drill_type: Database["public"]["Enums"]["drill_type"]
          estimated_minutes?: number
          id?: string
          model_answer?: string | null
          options?: Json | null
          prompt: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          rubric?: string | null
          scenario?: string | null
          source?: Database["public"]["Enums"]["drill_source"]
          status?: Database["public"]["Enums"]["drill_status"]
          tags?: string[] | null
          title: string
          updated_at?: string
          why_it_matters?: string | null
          xp_reward?: number
        }
        Update: {
          ai_feedback_enabled?: boolean
          category?: string
          cohort?: Database["public"]["Enums"]["drill_cohort"]
          correct_answer?: Json | null
          created_at?: string
          created_by?: string | null
          difficulty?: Database["public"]["Enums"]["drill_difficulty"]
          drill_type?: Database["public"]["Enums"]["drill_type"]
          estimated_minutes?: number
          id?: string
          model_answer?: string | null
          options?: Json | null
          prompt?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          rubric?: string | null
          scenario?: string | null
          source?: Database["public"]["Enums"]["drill_source"]
          status?: Database["public"]["Enums"]["drill_status"]
          tags?: string[] | null
          title?: string
          updated_at?: string
          why_it_matters?: string | null
          xp_reward?: number
        }
        Relationships: []
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
      escalation_events: {
        Row: {
          age_hours: number | null
          created_at: string
          id: string
          metadata: Json | null
          notified_user_ids: string[] | null
          rule: string
          target_id: string
          target_type: string
        }
        Insert: {
          age_hours?: number | null
          created_at?: string
          id?: string
          metadata?: Json | null
          notified_user_ids?: string[] | null
          rule: string
          target_id: string
          target_type: string
        }
        Update: {
          age_hours?: number | null
          created_at?: string
          id?: string
          metadata?: Json | null
          notified_user_ids?: string[] | null
          rule?: string
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      event_attendance: {
        Row: {
          created_at: string
          event_id: string
          id: string
          marked_at: string | null
          marked_by: string | null
          note: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          marked_at?: string | null
          marked_by?: string | null
          note?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          marked_at?: string | null
          marked_by?: string | null
          note?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_attendance_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_notifications: {
        Row: {
          audience_scope: string | null
          created_at: string
          error_message: string | null
          event_id: string
          failed_count: number
          id: string
          kind: string
          metadata: Json | null
          recipient_count: number
          status: string
          succeeded_count: number
          triggered_by: string | null
        }
        Insert: {
          audience_scope?: string | null
          created_at?: string
          error_message?: string | null
          event_id: string
          failed_count?: number
          id?: string
          kind: string
          metadata?: Json | null
          recipient_count?: number
          status?: string
          succeeded_count?: number
          triggered_by?: string | null
        }
        Update: {
          audience_scope?: string | null
          created_at?: string
          error_message?: string | null
          event_id?: string
          failed_count?: number
          id?: string
          kind?: string
          metadata?: Json | null
          recipient_count?: number
          status?: string
          succeeded_count?: number
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_notifications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_requests: {
        Row: {
          advisor_note: string | null
          created_at: string
          description: string | null
          event_date: string | null
          expected_attendance: number | null
          external_link: string | null
          id: string
          involves_food: boolean
          involves_minors: boolean
          involves_travel: boolean
          linked_event_id: string | null
          location: string | null
          requester_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          risk_notes: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          advisor_note?: string | null
          created_at?: string
          description?: string | null
          event_date?: string | null
          expected_attendance?: number | null
          external_link?: string | null
          id?: string
          involves_food?: boolean
          involves_minors?: boolean
          involves_travel?: boolean
          linked_event_id?: string | null
          location?: string | null
          requester_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_notes?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          advisor_note?: string | null
          created_at?: string
          description?: string | null
          event_date?: string | null
          expected_attendance?: number | null
          external_link?: string | null
          id?: string
          involves_food?: boolean
          involves_minors?: boolean
          involves_travel?: boolean
          linked_event_id?: string | null
          location?: string | null
          requester_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_notes?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      event_rsvps: {
        Row: {
          checked_in: boolean
          checked_in_at: string | null
          created_at: string
          event_id: string
          id: string
          user_id: string
        }
        Insert: {
          checked_in?: boolean
          checked_in_at?: string | null
          created_at?: string
          event_id: string
          id?: string
          user_id: string
        }
        Update: {
          checked_in?: boolean
          checked_in_at?: string | null
          created_at?: string
          event_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          audience_scope: string
          audience_target_id: string | null
          cancellation_reason: string | null
          cancelled: boolean
          cancelled_at: string | null
          capacity: number | null
          created_at: string
          created_by: string
          description: string | null
          end_time: string | null
          event_type: Database["public"]["Enums"]["event_type"]
          id: string
          is_public: boolean
          location: string | null
          meeting_link: string | null
          notify_on_create: boolean
          start_time: string
          teams_link: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          audience_scope?: string
          audience_target_id?: string | null
          cancellation_reason?: string | null
          cancelled?: boolean
          cancelled_at?: string | null
          capacity?: number | null
          created_at?: string
          created_by: string
          description?: string | null
          end_time?: string | null
          event_type?: Database["public"]["Enums"]["event_type"]
          id?: string
          is_public?: boolean
          location?: string | null
          meeting_link?: string | null
          notify_on_create?: boolean
          start_time: string
          teams_link?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          audience_scope?: string
          audience_target_id?: string | null
          cancellation_reason?: string | null
          cancelled?: boolean
          cancelled_at?: string | null
          capacity?: number | null
          created_at?: string
          created_by?: string
          description?: string | null
          end_time?: string | null
          event_type?: Database["public"]["Enums"]["event_type"]
          id?: string
          is_public?: boolean
          location?: string | null
          meeting_link?: string | null
          notify_on_create?: boolean
          start_time?: string
          teams_link?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          description: string | null
          enabled: boolean
          id: string
          key: string
          updated_at: string
        }
        Insert: {
          description?: string | null
          enabled?: boolean
          id?: string
          key: string
          updated_at?: string
        }
        Update: {
          description?: string | null
          enabled?: boolean
          id?: string
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
      feedback_events: {
        Row: {
          comment: string | null
          context_id: string | null
          context_type: string | null
          created_at: string
          feature: string
          id: string
          rating: string
          tag: string | null
          user_id: string
        }
        Insert: {
          comment?: string | null
          context_id?: string | null
          context_type?: string | null
          created_at?: string
          feature: string
          id?: string
          rating: string
          tag?: string | null
          user_id: string
        }
        Update: {
          comment?: string | null
          context_id?: string | null
          context_type?: string | null
          created_at?: string
          feature?: string
          id?: string
          rating?: string
          tag?: string | null
          user_id?: string
        }
        Relationships: []
      }
      feedback_tickets: {
        Row: {
          author_id: string
          body: string | null
          created_at: string
          id: string
          org_id: string | null
          project_id: string
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body?: string | null
          created_at?: string
          id?: string
          org_id?: string | null
          project_id: string
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string | null
          created_at?: string
          id?: string
          org_id?: string | null
          project_id?: string
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_tickets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_tickets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_requests: {
        Row: {
          advisor_note: string | null
          amount_cents: number | null
          cohort_id: string | null
          created_at: string
          description: string | null
          external_link: string | null
          id: string
          needed_by: string | null
          project_id: string | null
          request_type: string
          requester_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          title: string
          updated_at: string
          vendor: string | null
        }
        Insert: {
          advisor_note?: string | null
          amount_cents?: number | null
          cohort_id?: string | null
          created_at?: string
          description?: string | null
          external_link?: string | null
          id?: string
          needed_by?: string | null
          project_id?: string | null
          request_type?: string
          requester_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          title: string
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          advisor_note?: string | null
          amount_cents?: number | null
          cohort_id?: string | null
          created_at?: string
          description?: string | null
          external_link?: string | null
          id?: string
          needed_by?: string | null
          project_id?: string | null
          request_type?: string
          requester_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          title?: string
          updated_at?: string
          vendor?: string | null
        }
        Relationships: []
      }
      folders: {
        Row: {
          cohort_id: string | null
          created_at: string
          created_by: string
          id: string
          mock_project_id: string | null
          name: string
          parent_id: string | null
          project_id: string | null
        }
        Insert: {
          cohort_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          mock_project_id?: string | null
          name: string
          parent_id?: string | null
          project_id?: string | null
        }
        Update: {
          cohort_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          mock_project_id?: string | null
          name?: string
          parent_id?: string | null
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "folders_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folders_mock_project_id_fkey"
            columns: ["mock_project_id"]
            isOneToOne: false
            referencedRelation: "mock_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_docs: {
        Row: {
          author_id: string
          category: string
          content: string | null
          created_at: string
          id: string
          tags: string[] | null
          title: string
          updated_at: string
          version: number
          visibility: Database["public"]["Enums"]["doc_visibility"]
        }
        Insert: {
          author_id: string
          category?: string
          content?: string | null
          created_at?: string
          id?: string
          tags?: string[] | null
          title: string
          updated_at?: string
          version?: number
          visibility?: Database["public"]["Enums"]["doc_visibility"]
        }
        Update: {
          author_id?: string
          category?: string
          content?: string | null
          created_at?: string
          id?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          version?: number
          visibility?: Database["public"]["Enums"]["doc_visibility"]
        }
        Relationships: []
      }
      grind_progress: {
        Row: {
          current_streak: number
          drills_completed: number
          drills_correct: number
          last_attempt_date: string | null
          longest_streak: number
          total_xp: number
          updated_at: string
          user_id: string
        }
        Insert: {
          current_streak?: number
          drills_completed?: number
          drills_correct?: number
          last_attempt_date?: string | null
          longest_streak?: number
          total_xp?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          current_streak?: number
          drills_completed?: number
          drills_correct?: number
          last_attempt_date?: string | null
          longest_streak?: number
          total_xp?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      grind_skill_progress: {
        Row: {
          attempts: number
          category: string
          cohort: Database["public"]["Enums"]["drill_cohort"]
          correct: number
          id: string
          last_attempt_at: string | null
          total_xp: number
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          category: string
          cohort: Database["public"]["Enums"]["drill_cohort"]
          correct?: number
          id?: string
          last_attempt_at?: string | null
          total_xp?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          category?: string
          cohort?: Database["public"]["Enums"]["drill_cohort"]
          correct?: number
          id?: string
          last_attempt_at?: string | null
          total_xp?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      help_requests: {
        Row: {
          assigned_to: string | null
          body: string | null
          cohort_id: string | null
          created_at: string
          id: string
          requester_id: string
          resolution: string | null
          resolved_at: string | null
          status: string
          step_id: string | null
          subject: string
        }
        Insert: {
          assigned_to?: string | null
          body?: string | null
          cohort_id?: string | null
          created_at?: string
          id?: string
          requester_id: string
          resolution?: string | null
          resolved_at?: string | null
          status?: string
          step_id?: string | null
          subject: string
        }
        Update: {
          assigned_to?: string | null
          body?: string | null
          cohort_id?: string | null
          created_at?: string
          id?: string
          requester_id?: string
          resolution?: string | null
          resolved_at?: string | null
          status?: string
          step_id?: string | null
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "help_requests_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "help_requests_requester_profile_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "help_requests_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "lab_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_tokens: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          email_error: string | null
          email_provider_id: string | null
          email_sent_at: string | null
          email_status: string
          expires_at: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          email_error?: string | null
          email_provider_id?: string | null
          email_sent_at?: string | null
          email_status?: string
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          email_error?: string | null
          email_provider_id?: string | null
          email_sent_at?: string | null
          email_status?: string
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      judge_assignments: {
        Row: {
          competition_id: string
          id: string
          judge_user_id: string
        }
        Insert: {
          competition_id: string
          id?: string
          judge_user_id: string
        }
        Update: {
          competition_id?: string
          id?: string
          judge_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "judge_assignments_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      judge_scores: {
        Row: {
          application_id: string
          feedback: string | null
          id: string
          judge_id: string
          score: number
          scored_at: string
        }
        Insert: {
          application_id: string
          feedback?: string | null
          id?: string
          judge_id: string
          score: number
          scored_at?: string
        }
        Update: {
          application_id?: string
          feedback?: string | null
          id?: string
          judge_id?: string
          score?: number
          scored_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "judge_scores_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "competition_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_cards: {
        Row: {
          cohort_id: string | null
          created_at: string
          created_by: string
          help_request_id: string | null
          id: string
          solution: string
          tags: string[] | null
          title: string
        }
        Insert: {
          cohort_id?: string | null
          created_at?: string
          created_by: string
          help_request_id?: string | null
          id?: string
          solution: string
          tags?: string[] | null
          title: string
        }
        Update: {
          cohort_id?: string | null
          created_at?: string
          created_by?: string
          help_request_id?: string | null
          id?: string
          solution?: string
          tags?: string[] | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_cards_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_cards_help_request_id_fkey"
            columns: ["help_request_id"]
            isOneToOne: false
            referencedRelation: "help_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_manuals: {
        Row: {
          cohort_id: string
          created_at: string
          description: string | null
          id: string
          title: string
          version: number
        }
        Insert: {
          cohort_id: string
          created_at?: string
          description?: string | null
          id?: string
          title: string
          version?: number
        }
        Update: {
          cohort_id?: string
          created_at?: string
          description?: string | null
          id?: string
          title?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "lab_manuals_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_steps: {
        Row: {
          content: string | null
          created_at: string
          id: string
          manual_id: string
          order_index: number
          required_submission_type: string | null
          templates: Json | null
          title: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          manual_id: string
          order_index?: number
          required_submission_type?: string | null
          templates?: Json | null
          title: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          manual_id?: string
          order_index?: number
          required_submission_type?: string | null
          templates?: Json | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "lab_steps_manual_id_fkey"
            columns: ["manual_id"]
            isOneToOne: false
            referencedRelation: "lab_manuals"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          budget_range: string | null
          contact_email: string | null
          contact_name: string
          contact_phone: string | null
          contact_role: string | null
          created_at: string
          engagement_type: string | null
          id: string
          notes: string | null
          org_id: string | null
          recommended_cohort_id: string | null
          source: string | null
          stage: Database["public"]["Enums"]["lead_stage"]
          timeline: string | null
          updated_at: string
          urgency: string | null
          value: number | null
          website: string | null
        }
        Insert: {
          assigned_to?: string | null
          budget_range?: string | null
          contact_email?: string | null
          contact_name: string
          contact_phone?: string | null
          contact_role?: string | null
          created_at?: string
          engagement_type?: string | null
          id?: string
          notes?: string | null
          org_id?: string | null
          recommended_cohort_id?: string | null
          source?: string | null
          stage?: Database["public"]["Enums"]["lead_stage"]
          timeline?: string | null
          updated_at?: string
          urgency?: string | null
          value?: number | null
          website?: string | null
        }
        Update: {
          assigned_to?: string | null
          budget_range?: string | null
          contact_email?: string | null
          contact_name?: string
          contact_phone?: string | null
          contact_role?: string | null
          created_at?: string
          engagement_type?: string | null
          id?: string
          notes?: string | null
          org_id?: string | null
          recommended_cohort_id?: string | null
          source?: string | null
          stage?: Database["public"]["Enums"]["lead_stage"]
          timeline?: string | null
          updated_at?: string
          urgency?: string | null
          value?: number | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          content: string | null
          course_id: string
          created_at: string
          id: string
          order_index: number
          title: string
        }
        Insert: {
          content?: string | null
          course_id: string
          created_at?: string
          id?: string
          order_index?: number
          title: string
        }
        Update: {
          content?: string | null
          course_id?: string
          created_at?: string
          id?: string
          order_index?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_briefs: {
        Row: {
          brief_markdown: string
          created_at: string
          event_id: string
          generated_by: string
          id: string
          model: string | null
          source_snapshot: Json
        }
        Insert: {
          brief_markdown: string
          created_at?: string
          event_id: string
          generated_by: string
          id?: string
          model?: string | null
          source_snapshot?: Json
        }
        Update: {
          brief_markdown?: string
          created_at?: string
          event_id?: string
          generated_by?: string
          id?: string
          model?: string | null
          source_snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "meeting_briefs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_notes: {
        Row: {
          action_items: Json | null
          attendees: string[] | null
          author_id: string
          content: string | null
          created_at: string
          external_visible: boolean
          id: string
          meeting_date: string
          project_id: string
          title: string
        }
        Insert: {
          action_items?: Json | null
          attendees?: string[] | null
          author_id: string
          content?: string | null
          created_at?: string
          external_visible?: boolean
          id?: string
          meeting_date?: string
          project_id: string
          title: string
        }
        Update: {
          action_items?: Json | null
          attendees?: string[] | null
          author_id?: string
          content?: string | null
          created_at?: string
          external_visible?: boolean
          id?: string
          meeting_date?: string
          project_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_notes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_proposals: {
        Row: {
          attendance_score: number
          candidate_time: string
          cohort_id: string | null
          conflict_count: number
          created_at: string
          duration_minutes: number
          explanation: string | null
          id: string
          project_id: string | null
          proposed_by: string
          status: string
          updated_at: string
        }
        Insert: {
          attendance_score?: number
          candidate_time: string
          cohort_id?: string | null
          conflict_count?: number
          created_at?: string
          duration_minutes?: number
          explanation?: string | null
          id?: string
          project_id?: string | null
          proposed_by: string
          status?: string
          updated_at?: string
        }
        Update: {
          attendance_score?: number
          candidate_time?: string
          cohort_id?: string | null
          conflict_count?: number
          created_at?: string
          duration_minutes?: number
          explanation?: string | null
          id?: string
          project_id?: string | null
          proposed_by?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_proposals_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_proposals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          author_id: string
          channel_id: string
          content: string
          created_at: string
          id: string
          mentions: string[] | null
          message_type: Database["public"]["Enums"]["message_type"]
          parent_id: string | null
          reactions: Json | null
          updated_at: string
        }
        Insert: {
          author_id: string
          channel_id: string
          content: string
          created_at?: string
          id?: string
          mentions?: string[] | null
          message_type?: Database["public"]["Enums"]["message_type"]
          parent_id?: string | null
          reactions?: Json | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          channel_id?: string
          content?: string
          created_at?: string
          id?: string
          mentions?: string[] | null
          message_type?: Database["public"]["Enums"]["message_type"]
          parent_id?: string | null
          reactions?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_author_profile_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          progress: number
          project_id: string
          status: Database["public"]["Enums"]["milestone_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          progress?: number
          project_id: string
          status?: Database["public"]["Enums"]["milestone_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          progress?: number
          project_id?: string
          status?: Database["public"]["Enums"]["milestone_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_project_memberships: {
        Row: {
          id: string
          joined_at: string
          lane: string | null
          mock_project_id: string
          role_on_project: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          lane?: string | null
          mock_project_id: string
          role_on_project?: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          lane?: string | null
          mock_project_id?: string
          role_on_project?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mock_project_memberships_mock_project_id_fkey"
            columns: ["mock_project_id"]
            isOneToOne: false
            referencedRelation: "mock_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_project_memberships_user_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      mock_projects: {
        Row: {
          cohort_id: string
          created_at: string
          deliverables_desc: string | null
          id: string
          objectives: string | null
          rubric: Json | null
          scenario: string | null
          status: string
          title: string
        }
        Insert: {
          cohort_id: string
          created_at?: string
          deliverables_desc?: string | null
          id?: string
          objectives?: string | null
          rubric?: Json | null
          scenario?: string | null
          status?: string
          title: string
        }
        Update: {
          cohort_id?: string
          created_at?: string
          deliverables_desc?: string | null
          id?: string
          objectives?: string | null
          rubric?: Json | null
          scenario?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "mock_projects_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      momentum_signals: {
        Row: {
          computed_at: string
          id: string
          project_id: string
          risk_level: string
          risk_score: number
          signals: Json
        }
        Insert: {
          computed_at?: string
          id?: string
          project_id: string
          risk_level?: string
          risk_score?: number
          signals?: Json
        }
        Update: {
          computed_at?: string
          id?: string
          project_id?: string
          risk_level?: string
          risk_score?: number
          signals?: Json
        }
        Relationships: [
          {
            foreignKeyName: "momentum_signals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_dispatch_log: {
        Row: {
          channel: string
          created_at: string
          error_message: string | null
          id: string
          metadata: Json | null
          notification_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          channel: string
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          notification_id?: string | null
          status: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          notification_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          assignments: boolean
          channel_email: boolean
          channel_in_app: boolean
          channel_teams: boolean
          cohort_only: boolean
          digest_frequency: string
          events: boolean
          keywords: string[]
          leadership_alerts: boolean
          mentions: boolean
          preset: string
          reviews: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          assignments?: boolean
          channel_email?: boolean
          channel_in_app?: boolean
          channel_teams?: boolean
          cohort_only?: boolean
          digest_frequency?: string
          events?: boolean
          keywords?: string[]
          leadership_alerts?: boolean
          mentions?: boolean
          preset?: string
          reviews?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          assignments?: boolean
          channel_email?: boolean
          channel_in_app?: boolean
          channel_teams?: boolean
          cohort_only?: boolean
          digest_frequency?: string
          events?: boolean
          keywords?: string[]
          leadership_alerts?: boolean
          mentions?: boolean
          preset?: string
          reviews?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_id: string | null
          body: string | null
          category: string
          created_at: string
          dedupe_key: string | null
          escalated: boolean
          id: string
          link: string | null
          metadata: Json | null
          priority: string
          read: boolean
          target_id: string | null
          target_type: string | null
          title: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          body?: string | null
          category?: string
          created_at?: string
          dedupe_key?: string | null
          escalated?: boolean
          id?: string
          link?: string | null
          metadata?: Json | null
          priority?: string
          read?: boolean
          target_id?: string | null
          target_type?: string | null
          title: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          body?: string | null
          category?: string
          created_at?: string
          dedupe_key?: string | null
          escalated?: boolean
          id?: string
          link?: string | null
          metadata?: Json | null
          priority?: string
          read?: boolean
          target_id?: string | null
          target_type?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      opportunities: {
        Row: {
          alignment_tags: string[] | null
          assigned_cohort_id: string | null
          created_at: string
          created_by: string
          deadline: string | null
          decision_rationale: string | null
          effort_estimate: string | null
          engagement_project_id: string | null
          id: string
          recommended_cohort_id: string | null
          skill_requirements: string[] | null
          source: string | null
          status: Database["public"]["Enums"]["opportunity_status"]
          strategic_value: number | null
          summary: string | null
          title: string
          type: Database["public"]["Enums"]["opportunity_type"]
          updated_at: string
        }
        Insert: {
          alignment_tags?: string[] | null
          assigned_cohort_id?: string | null
          created_at?: string
          created_by: string
          deadline?: string | null
          decision_rationale?: string | null
          effort_estimate?: string | null
          engagement_project_id?: string | null
          id?: string
          recommended_cohort_id?: string | null
          skill_requirements?: string[] | null
          source?: string | null
          status?: Database["public"]["Enums"]["opportunity_status"]
          strategic_value?: number | null
          summary?: string | null
          title: string
          type: Database["public"]["Enums"]["opportunity_type"]
          updated_at?: string
        }
        Update: {
          alignment_tags?: string[] | null
          assigned_cohort_id?: string | null
          created_at?: string
          created_by?: string
          deadline?: string | null
          decision_rationale?: string | null
          effort_estimate?: string | null
          engagement_project_id?: string | null
          id?: string
          recommended_cohort_id?: string | null
          skill_requirements?: string[] | null
          source?: string | null
          status?: Database["public"]["Enums"]["opportunity_status"]
          strategic_value?: number | null
          summary?: string | null
          title?: string
          type?: Database["public"]["Enums"]["opportunity_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_assigned_cohort_id_fkey"
            columns: ["assigned_cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_engagement_project_id_fkey"
            columns: ["engagement_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_recommended_cohort_id_fkey"
            columns: ["recommended_cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      ops_tasks: {
        Row: {
          assignee_id: string | null
          category: string
          cohort_id: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          priority: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          category?: string
          cohort_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          category?: string
          cohort_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ops_tasks_assignee_profile_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "ops_tasks_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          logo_url: string | null
          name: string
          tier: string | null
          type: string
          updated_at: string
          website: string | null
        }
        Insert: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          tier?: string | null
          type?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          tier?: string | null
          type?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      peer_evaluations: {
        Row: {
          contribution_notes: string | null
          created_at: string
          evaluatee_id: string
          evaluator_id: string
          id: string
          project_id: string
          score: number | null
        }
        Insert: {
          contribution_notes?: string | null
          created_at?: string
          evaluatee_id: string
          evaluator_id: string
          id?: string
          project_id: string
          score?: number | null
        }
        Update: {
          contribution_notes?: string | null
          created_at?: string
          evaluatee_id?: string
          evaluator_id?: string
          id?: string
          project_id?: string
          score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "peer_evaluations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      pinned_items: {
        Row: {
          id: string
          item_id: string
          item_type: string
          label: string
          link: string
          pinned_at: string
          user_id: string
        }
        Insert: {
          id?: string
          item_id: string
          item_type: string
          label: string
          link: string
          pinned_at?: string
          user_id: string
        }
        Update: {
          id?: string
          item_id?: string
          item_type?: string
          label?: string
          link?: string
          pinned_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          availability_set_at: string | null
          avatar_url: string | null
          bio: string | null
          cal_poly_email: string | null
          chapter_id: string | null
          created_at: string
          full_name: string
          graduation_year: number | null
          id: string
          invite_state: string
          last_dashboard_visit_at: string | null
          linkedin_url: string | null
          major: string | null
          onboarding_completed: boolean
          phone: string | null
          skills: string[] | null
          status: Database["public"]["Enums"]["member_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          availability_set_at?: string | null
          avatar_url?: string | null
          bio?: string | null
          cal_poly_email?: string | null
          chapter_id?: string | null
          created_at?: string
          full_name?: string
          graduation_year?: number | null
          id?: string
          invite_state?: string
          last_dashboard_visit_at?: string | null
          linkedin_url?: string | null
          major?: string | null
          onboarding_completed?: boolean
          phone?: string | null
          skills?: string[] | null
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          availability_set_at?: string | null
          avatar_url?: string | null
          bio?: string | null
          cal_poly_email?: string | null
          chapter_id?: string | null
          created_at?: string
          full_name?: string
          graduation_year?: number | null
          id?: string
          invite_state?: string
          last_dashboard_visit_at?: string | null
          linkedin_url?: string | null
          major?: string | null
          onboarding_completed?: boolean
          phone?: string | null
          skills?: string[] | null
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      project_group_members: {
        Row: {
          created_at: string
          group_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "project_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      project_groups: {
        Row: {
          archived: boolean
          archived_at: string | null
          created_at: string
          created_by: string
          id: string
          lead_user_id: string | null
          name: string
          project_id: string
          updated_at: string
        }
        Insert: {
          archived?: boolean
          archived_at?: string | null
          created_at?: string
          created_by: string
          id?: string
          lead_user_id?: string | null
          name: string
          project_id: string
          updated_at?: string
        }
        Update: {
          archived?: boolean
          archived_at?: string | null
          created_at?: string
          created_by?: string
          id?: string
          lead_user_id?: string | null
          name?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_groups_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_memberships: {
        Row: {
          id: string
          joined_at: string
          lane: string | null
          project_id: string
          role_on_project: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          lane?: string | null
          project_id: string
          role_on_project?: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          lane?: string | null
          project_id?: string
          role_on_project?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_memberships_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_memberships_user_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      project_stages: {
        Row: {
          completed_at: string | null
          created_at: string
          due_date: string | null
          id: string
          mock_project_id: string
          name: string
          order_index: number
          required_deliverables: Json | null
          status: string
          unlocked_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          mock_project_id: string
          name: string
          order_index?: number
          required_deliverables?: Json | null
          status?: string
          unlocked_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          mock_project_id?: string
          name?: string
          order_index?: number
          required_deliverables?: Json | null
          status?: string
          unlocked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_stages_mock_project_id_fkey"
            columns: ["mock_project_id"]
            isOneToOne: false
            referencedRelation: "mock_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_templates: {
        Row: {
          cohort_scope: string
          created_at: string
          description: string | null
          engagement_type: string
          id: string
          is_active: boolean
          name: string
          project_mode: Database["public"]["Enums"]["project_mode"]
          updated_at: string
        }
        Insert: {
          cohort_scope?: string
          created_at?: string
          description?: string | null
          engagement_type?: string
          id?: string
          is_active?: boolean
          name: string
          project_mode?: Database["public"]["Enums"]["project_mode"]
          updated_at?: string
        }
        Update: {
          cohort_scope?: string
          created_at?: string
          description?: string | null
          engagement_type?: string
          id?: string
          is_active?: boolean
          name?: string
          project_mode?: Database["public"]["Enums"]["project_mode"]
          updated_at?: string
        }
        Relationships: []
      }
      project_updates: {
        Row: {
          author_id: string
          blockers: string | null
          created_at: string
          health: string
          id: string
          next_steps: string | null
          project_id: string
          summary: string
        }
        Insert: {
          author_id: string
          blockers?: string | null
          created_at?: string
          health?: string
          id?: string
          next_steps?: string | null
          project_id: string
          summary: string
        }
        Update: {
          author_id?: string
          blockers?: string | null
          created_at?: string
          health?: string
          id?: string
          next_steps?: string | null
          project_id?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_updates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          chapter_id: string | null
          client_org_id: string | null
          created_at: string
          created_by: string
          description: string | null
          end_date: string | null
          id: string
          name: string
          project_mode: Database["public"]["Enums"]["project_mode"]
          requires_client_gate: boolean
          scope: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
          visibility_scope: Database["public"]["Enums"]["visibility_scope"]
        }
        Insert: {
          chapter_id?: string | null
          client_org_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          project_mode?: Database["public"]["Enums"]["project_mode"]
          requires_client_gate?: boolean
          scope?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          visibility_scope?: Database["public"]["Enums"]["visibility_scope"]
        }
        Update: {
          chapter_id?: string | null
          client_org_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          project_mode?: Database["public"]["Enums"]["project_mode"]
          requires_client_gate?: boolean
          scope?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          visibility_scope?: Database["public"]["Enums"]["visibility_scope"]
        }
        Relationships: [
          {
            foreignKeyName: "projects_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_client_org_id_fkey"
            columns: ["client_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      public_metrics: {
        Row: {
          display_order: number
          id: string
          label: string
          metric_key: string
          source: string
          subtitle: string | null
          updated_at: string
          updated_by: string | null
          value: string
          visible: boolean
        }
        Insert: {
          display_order?: number
          id?: string
          label: string
          metric_key: string
          source?: string
          subtitle?: string | null
          updated_at?: string
          updated_by?: string | null
          value: string
          visible?: boolean
        }
        Update: {
          display_order?: number
          id?: string
          label?: string
          metric_key?: string
          source?: string
          subtitle?: string | null
          updated_at?: string
          updated_by?: string | null
          value?: string
          visible?: boolean
        }
        Relationships: []
      }
      purpose_artifacts: {
        Row: {
          artifact_type: string
          content: string | null
          created_at: string
          created_by: string
          file_url: string | null
          id: string
          milestone_id: string | null
          purpose_track_id: string
          title: string
        }
        Insert: {
          artifact_type?: string
          content?: string | null
          created_at?: string
          created_by: string
          file_url?: string | null
          id?: string
          milestone_id?: string | null
          purpose_track_id: string
          title: string
        }
        Update: {
          artifact_type?: string
          content?: string | null
          created_at?: string
          created_by?: string
          file_url?: string | null
          id?: string
          milestone_id?: string | null
          purpose_track_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "purpose_artifacts_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "purpose_milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purpose_artifacts_purpose_track_id_fkey"
            columns: ["purpose_track_id"]
            isOneToOne: false
            referencedRelation: "purpose_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      purpose_milestones: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          id: string
          order_index: number
          purpose_track_id: string
          status: string
          target_date: string | null
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          order_index?: number
          purpose_track_id: string
          status?: string
          target_date?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          order_index?: number
          purpose_track_id?: string
          status?: string
          target_date?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purpose_milestones_purpose_track_id_fkey"
            columns: ["purpose_track_id"]
            isOneToOne: false
            referencedRelation: "purpose_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      purpose_tracks: {
        Row: {
          cohort_id: string
          created_at: string
          created_by: string
          current_phase: Database["public"]["Enums"]["purpose_phase"]
          development_themes: string[] | null
          field_thesis: string | null
          id: string
          long_term_objective: string | null
          mission_statement: string | null
          open_problems: string[] | null
          research_themes: string[] | null
          status: string
          title: string
          updated_at: string
          why_it_matters: string | null
        }
        Insert: {
          cohort_id: string
          created_at?: string
          created_by: string
          current_phase?: Database["public"]["Enums"]["purpose_phase"]
          development_themes?: string[] | null
          field_thesis?: string | null
          id?: string
          long_term_objective?: string | null
          mission_statement?: string | null
          open_problems?: string[] | null
          research_themes?: string[] | null
          status?: string
          title: string
          updated_at?: string
          why_it_matters?: string | null
        }
        Update: {
          cohort_id?: string
          created_at?: string
          created_by?: string
          current_phase?: Database["public"]["Enums"]["purpose_phase"]
          development_themes?: string[] | null
          field_thesis?: string | null
          id?: string
          long_term_objective?: string | null
          mission_statement?: string | null
          open_problems?: string[] | null
          research_themes?: string[] | null
          status?: string
          title?: string
          updated_at?: string
          why_it_matters?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purpose_tracks_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          created_at: string
          id: string
          lesson_id: string
          passing_score: number
          questions: Json
        }
        Insert: {
          created_at?: string
          id?: string
          lesson_id: string
          passing_score?: number
          questions?: Json
        }
        Update: {
          created_at?: string
          id?: string
          lesson_id?: string
          passing_score?: number
          questions?: Json
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      recent_items: {
        Row: {
          id: string
          item_id: string
          item_type: string
          label: string
          link: string
          metadata: Json | null
          user_id: string
          visited_at: string
        }
        Insert: {
          id?: string
          item_id: string
          item_type: string
          label: string
          link: string
          metadata?: Json | null
          user_id: string
          visited_at?: string
        }
        Update: {
          id?: string
          item_id?: string
          item_type?: string
          label?: string
          link?: string
          metadata?: Json | null
          user_id?: string
          visited_at?: string
        }
        Relationships: []
      }
      recruiting_applications: {
        Row: {
          applicant_email: string
          applicant_name: string
          cover_letter: string | null
          created_at: string
          id: string
          resume_url: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          applicant_email: string
          applicant_name: string
          cover_letter?: string | null
          created_at?: string
          id?: string
          resume_url?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          applicant_email?: string
          applicant_name?: string
          cover_letter?: string | null
          created_at?: string
          id?: string
          resume_url?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      review_rubrics: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          mock_project_id: string | null
          project_id: string | null
          weight: number
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          id?: string
          mock_project_id?: string | null
          project_id?: string | null
          weight?: number
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          mock_project_id?: string | null
          project_id?: string | null
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "review_rubrics_mock_project_id_fkey"
            columns: ["mock_project_id"]
            isOneToOne: false
            referencedRelation: "mock_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_rubrics_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      reviewer_scores: {
        Row: {
          application_id: string
          id: string
          notes: string | null
          reviewer_id: string
          rubric: Json | null
          score: number
          scored_at: string
        }
        Insert: {
          application_id: string
          id?: string
          notes?: string | null
          reviewer_id: string
          rubric?: Json | null
          score: number
          scored_at?: string
        }
        Update: {
          application_id?: string
          id?: string
          notes?: string | null
          reviewer_id?: string
          rubric?: Json | null
          score?: number
          scored_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviewer_scores_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "recruiting_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comments: string | null
          id: string
          reviewed_at: string
          reviewer_id: string
          rubric_scores: Json | null
          status: string
          submission_id: string
        }
        Insert: {
          comments?: string | null
          id?: string
          reviewed_at?: string
          reviewer_id: string
          rubric_scores?: Json | null
          status?: string
          submission_id: string
        }
        Update: {
          comments?: string | null
          id?: string
          reviewed_at?: string
          reviewer_id?: string
          rubric_scores?: Json | null
          status?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      risks: {
        Row: {
          created_at: string
          description: string | null
          id: string
          mitigation: string | null
          owner_id: string | null
          project_id: string
          severity: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          mitigation?: string | null
          owner_id?: string | null
          project_id: string
          severity?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          mitigation?: string | null
          owner_id?: string | null
          project_id?: string
          severity?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "risks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      role_requests: {
        Row: {
          created_at: string
          id: string
          reason: string | null
          requested_role: Database["public"]["Enums"]["app_role"]
          reviewed_at: string | null
          reviewer_id: string | null
          status: Database["public"]["Enums"]["role_request_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason?: string | null
          requested_role: Database["public"]["Enums"]["app_role"]
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: Database["public"]["Enums"]["role_request_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string | null
          requested_role?: Database["public"]["Enums"]["app_role"]
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: Database["public"]["Enums"]["role_request_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_requests_user_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      sponsorship_packages: {
        Row: {
          amount: number | null
          benefits: Json | null
          created_at: string
          end_date: string | null
          id: string
          name: string
          org_id: string
          start_date: string | null
          tier: string
        }
        Insert: {
          amount?: number | null
          benefits?: Json | null
          created_at?: string
          end_date?: string | null
          id?: string
          name: string
          org_id: string
          start_date?: string | null
          tier?: string
        }
        Update: {
          amount?: number | null
          benefits?: Json | null
          created_at?: string
          end_date?: string | null
          id?: string
          name?: string
          org_id?: string
          start_date?: string | null
          tier?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsorship_packages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          content: string | null
          file_url: string | null
          id: string
          link_url: string | null
          status: string
          step_id: string
          submitted_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string | null
          file_url?: string | null
          id?: string
          link_url?: string | null
          status?: string
          step_id: string
          submitted_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string | null
          file_url?: string | null
          id?: string
          link_url?: string | null
          status?: string
          step_id?: string
          submitted_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "lab_steps"
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
      tasks: {
        Row: {
          assignee_id: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          priority: Database["public"]["Enums"]["task_priority"]
          project_id: string
          source_message_id: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id: string
          source_message_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id?: string
          source_message_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_profile_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      template_deliverables: {
        Row: {
          approval_required: boolean
          created_at: string
          default_owner_role: string | null
          description: string | null
          id: string
          required: boolean
          stage_order_index: number
          template_id: string
          title: string
        }
        Insert: {
          approval_required?: boolean
          created_at?: string
          default_owner_role?: string | null
          description?: string | null
          id?: string
          required?: boolean
          stage_order_index?: number
          template_id: string
          title: string
        }
        Update: {
          approval_required?: boolean
          created_at?: string
          default_owner_role?: string | null
          description?: string | null
          id?: string
          required?: boolean
          stage_order_index?: number
          template_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_deliverables_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "project_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      template_stages: {
        Row: {
          created_at: string
          default_duration_days: number
          description: string | null
          id: string
          name: string
          order_index: number
          template_id: string
        }
        Insert: {
          created_at?: string
          default_duration_days?: number
          description?: string | null
          id?: string
          name: string
          order_index?: number
          template_id: string
        }
        Update: {
          created_at?: string
          default_duration_days?: number
          description?: string | null
          id?: string
          name?: string
          order_index?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_stages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "project_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      track_assignments: {
        Row: {
          assigned_at: string
          id: string
          track_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          id?: string
          track_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          id?: string
          track_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "track_assignments_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      tracks: {
        Row: {
          cohort_id: string
          id: string
          name: string
        }
        Insert: {
          cohort_id: string
          id?: string
          name?: string
        }
        Update: {
          cohort_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracks_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      training_ai_settings: {
        Row: {
          current_month: string
          current_month_calls: number
          enabled_drill_types: string[]
          id: number
          monthly_call_cap: number
          per_user_daily_cap: number
          updated_at: string
        }
        Insert: {
          current_month?: string
          current_month_calls?: number
          enabled_drill_types?: string[]
          id?: number
          monthly_call_cap?: number
          per_user_daily_cap?: number
          updated_at?: string
        }
        Update: {
          current_month?: string
          current_month_calls?: number
          enabled_drill_types?: string[]
          id?: number
          monthly_call_cap?: number
          per_user_daily_cap?: number
          updated_at?: string
        }
        Relationships: []
      }
      training_ai_usage: {
        Row: {
          attempt_id: string | null
          cohort: Database["public"]["Enums"]["drill_cohort"] | null
          created_at: string
          drill_id: string | null
          drill_type: Database["public"]["Enums"]["drill_type"] | null
          estimated_tokens: number | null
          fallback_used: boolean
          id: string
          month: string
          user_id: string
        }
        Insert: {
          attempt_id?: string | null
          cohort?: Database["public"]["Enums"]["drill_cohort"] | null
          created_at?: string
          drill_id?: string | null
          drill_type?: Database["public"]["Enums"]["drill_type"] | null
          estimated_tokens?: number | null
          fallback_used?: boolean
          id?: string
          month?: string
          user_id: string
        }
        Update: {
          attempt_id?: string | null
          cohort?: Database["public"]["Enums"]["drill_cohort"] | null
          created_at?: string
          drill_id?: string | null
          drill_type?: Database["public"]["Enums"]["drill_type"] | null
          estimated_tokens?: number | null
          fallback_used?: boolean
          id?: string
          month?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_ai_usage_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "drill_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_ai_usage_drill_id_fkey"
            columns: ["drill_id"]
            isOneToOne: false
            referencedRelation: "drills"
            referencedColumns: ["id"]
          },
        ]
      }
      training_challenges: {
        Row: {
          bonus_xp_multiplier: number
          category_filter: string[]
          cohort: Database["public"]["Enums"]["drill_cohort"]
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string
          id: string
          name: string
          starts_at: string
        }
        Insert: {
          bonus_xp_multiplier?: number
          category_filter?: string[]
          cohort: Database["public"]["Enums"]["drill_cohort"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at: string
          id?: string
          name: string
          starts_at?: string
        }
        Update: {
          bonus_xp_multiplier?: number
          category_filter?: string[]
          cohort?: Database["public"]["Enums"]["drill_cohort"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string
          id?: string
          name?: string
          starts_at?: string
        }
        Relationships: []
      }
      training_themes: {
        Row: {
          category_filter: string[]
          cohort: Database["public"]["Enums"]["drill_cohort"]
          created_at: string
          created_by: string | null
          description: string | null
          ends_on: string
          id: string
          name: string
          starts_on: string
        }
        Insert: {
          category_filter?: string[]
          cohort: Database["public"]["Enums"]["drill_cohort"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_on: string
          id?: string
          name: string
          starts_on?: string
        }
        Update: {
          category_filter?: string[]
          cohort?: Database["public"]["Enums"]["drill_cohort"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_on?: string
          id?: string
          name?: string
          starts_on?: string
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          awarded_at: string
          badge_id: string
          id: string
          user_id: string
        }
        Insert: {
          awarded_at?: string
          badge_id: string
          id?: string
          user_id: string
        }
        Update: {
          awarded_at?: string
          badge_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
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
      approve_deliverable: {
        Args: { p_deliverable_id: string }
        Returns: undefined
      }
      array_overlap_count: {
        Args: { a: string[]; b: string[] }
        Returns: number
      }
      auto_backfill_project_memberships: { Args: never; Returns: number }
      auto_close_stale_help_requests: { Args: never; Returns: number }
      auto_flag_stale_reviews: { Args: never; Returns: number }
      auto_join_missing_channels: { Args: never; Returns: number }
      auto_resync_unmatched_users: { Args: never; Returns: number }
      calendar_awareness_hints: {
        Args: { p_cohort_id: string }
        Returns: {
          hint_type: string
          message: string
          metadata: Json
          tone: string
        }[]
      }
      can_host_event: {
        Args: { _event_id: string; _user_id: string }
        Returns: boolean
      }
      cohort_meeting_status: { Args: { p_cohort_id: string }; Returns: Json }
      cohort_performance: { Args: { p_cohort_id: string }; Returns: Json }
      compute_momentum_risk: { Args: { _project_id: string }; Returns: Json }
      create_assignment_bundle: {
        Args: {
          p_description?: string
          p_due_date?: string
          p_milestone_id?: string
          p_note?: string
          p_owner_id: string
          p_priority?: string
          p_project_id: string
          p_reviewer_id?: string
          p_title: string
        }
        Returns: string
      }
      create_notification: {
        Args: {
          p_actor_id?: string
          p_body?: string
          p_category: string
          p_dedupe_key?: string
          p_link?: string
          p_metadata?: Json
          p_priority?: string
          p_target_id?: string
          p_target_type?: string
          p_title: string
          p_user_id: string
        }
        Returns: string
      }
      create_project_from_template: {
        Args: {
          p_cohort_id?: string
          p_description?: string
          p_name: string
          p_template_id: string
        }
        Returns: string
      }
      dashboard_changes_since: { Args: { p_since: string }; Returns: Json }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      detect_cohort_meeting_pattern: {
        Args: { p_cohort_id: string }
        Returns: {
          day_of_week: number
          occurrences: number
          stability: string
          start_hour: number
        }[]
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      event_expected_attendees: {
        Args: { p_event_id: string }
        Returns: {
          full_name: string
          user_id: string
        }[]
      }
      feedback_summary: {
        Args: { p_days?: number }
        Returns: {
          feature: string
          negative: number
          neutral: number
          positive: number
          positive_pct: number
          total: number
        }[]
      }
      find_related_decisions: {
        Args: {
          _category?: string
          _limit?: number
          _project_id: string
          _tags?: string[]
        }
        Returns: {
          category: string
          decided_at: string
          id: string
          project_id: string
          rationale: string
          relevance: number
          tags: string[]
          title: string
        }[]
      }
      get_milestone_blockers: {
        Args: { p_milestone_id: string }
        Returns: {
          approval_required: boolean
          approval_status: string
          due_date: string
          file_url: string
          id: string
          owner_id: string
          title: string
          version: number
        }[]
      }
      get_user_cohort_id: { Args: { _user_id: string }; Returns: string }
      grind_leaderboard: {
        Args: {
          p_cohort?: Database["public"]["Enums"]["drill_cohort"]
          p_limit?: number
        }
        Returns: {
          accuracy: number
          current_streak: number
          drills_completed: number
          full_name: string
          rank: number
          total_xp: number
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_active_member: { Args: { _user_id: string }; Returns: boolean }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_advisor: { Args: { _user_id: string }; Returns: boolean }
      is_board_or_admin: { Args: { _user_id: string }; Returns: boolean }
      is_channel_member: {
        Args: { _channel_id: string; _user_id: string }
        Returns: boolean
      }
      is_cohort_host: {
        Args: { _cohort_id: string; _user_id: string }
        Returns: boolean
      }
      is_project_lead: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      is_project_member: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      join_user_to_default_channels: {
        Args: { p_cohort_name: string; p_role: string; p_user_id: string }
        Returns: undefined
      }
      mark_notifications_read: { Args: { p_ids?: string[] }; Returns: number }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      recommend_challenge_drills: {
        Args: {
          p_cohort?: Database["public"]["Enums"]["drill_cohort"]
          p_limit?: number
        }
        Returns: {
          bonus_xp_multiplier: number
          category: string
          challenge_name: string
          cohort: Database["public"]["Enums"]["drill_cohort"]
          difficulty: Database["public"]["Enums"]["drill_difficulty"]
          drill_type: Database["public"]["Enums"]["drill_type"]
          ends_at: string
          estimated_minutes: number
          id: string
          reason: string
          title: string
          xp_reward: number
        }[]
      }
      recommend_drills: {
        Args: {
          p_cohort?: Database["public"]["Enums"]["drill_cohort"]
          p_limit?: number
        }
        Returns: {
          category: string
          cohort: Database["public"]["Enums"]["drill_cohort"]
          difficulty: Database["public"]["Enums"]["drill_difficulty"]
          drill_type: Database["public"]["Enums"]["drill_type"]
          estimated_minutes: number
          id: string
          reason: string
          title: string
          xp_reward: number
        }[]
      }
      recommend_meeting_slots: {
        Args: {
          p_attendee_ids?: string[]
          p_cohort_id: string
          p_duration_min?: number
          p_limit?: number
        }
        Returns: {
          attendance_pct: number
          available_count: number
          available_user_ids: string[]
          conflict_count: number
          day_of_week: number
          duration_min: number
          end_hour: number
          lead_count: number
          missing_user_ids: string[]
          rank_label: string
          score: number
          start_hour: number
          total_count: number
        }[]
      }
      recommend_theme_drills: {
        Args: {
          p_cohort?: Database["public"]["Enums"]["drill_cohort"]
          p_limit?: number
        }
        Returns: {
          category: string
          cohort: Database["public"]["Enums"]["drill_cohort"]
          difficulty: Database["public"]["Enums"]["drill_difficulty"]
          drill_type: Database["public"]["Enums"]["drill_type"]
          estimated_minutes: number
          id: string
          reason: string
          theme_name: string
          title: string
          xp_reward: number
        }[]
      }
      recommend_weak_skill_drills: {
        Args: {
          p_cohort?: Database["public"]["Enums"]["drill_cohort"]
          p_limit?: number
        }
        Returns: {
          category: string
          cohort: Database["public"]["Enums"]["drill_cohort"]
          difficulty: Database["public"]["Enums"]["drill_difficulty"]
          drill_type: Database["public"]["Enums"]["drill_type"]
          estimated_minutes: number
          id: string
          reason: string
          title: string
          xp_reward: number
        }[]
      }
      reject_deliverable: {
        Args: { p_deliverable_id: string; p_reason: string }
        Returns: undefined
      }
      request_deliverable_changes: {
        Args: { p_deliverable_id: string; p_reason: string }
        Returns: undefined
      }
      resync_user_from_roster: { Args: { p_user_id: string }; Returns: Json }
      run_escalation_scan: { Args: never; Returns: Json }
      run_momentum_scan: { Args: never; Returns: Json }
      run_nexus_self_heal: { Args: never; Returns: Json }
      seed_project_memberships_from_cohort: {
        Args: { p_cohort_id: string; p_project_id: string }
        Returns: number
      }
      submit_drill_attempt: {
        Args: {
          p_drill_id: string
          p_is_correct: boolean
          p_response: Json
          p_self_score?: number
          p_time_spent_seconds?: number
        }
        Returns: Json
      }
      touch_dashboard_visit: { Args: never; Returns: string }
      track_recent_item: {
        Args: {
          p_item_id: string
          p_item_type: string
          p_label: string
          p_link: string
          p_metadata?: Json
        }
        Returns: undefined
      }
      training_ai_usage_summary: { Args: never; Returns: Json }
      training_ai_user_today_count: {
        Args: { p_user: string }
        Returns: number
      }
    }
    Enums: {
      app_role:
        | "applicant"
        | "member"
        | "project_consultant"
        | "project_lead"
        | "board_member"
        | "admin"
        | "superadmin"
        | "advisor"
        | "president"
        | "director_of_projects"
        | "outreach_lead"
      approval_status:
        | "pending"
        | "approved"
        | "rejected"
        | "revision_requested"
      crm_activity_type:
        | "email_sent"
        | "follow_up_sent"
        | "linkedin_message"
        | "phone_call"
        | "meeting"
        | "research_note"
        | "internal_note"
        | "status_change"
        | "task_completed"
      crm_conversion_type:
        | "project_inquiry"
        | "sponsor_interest"
        | "speaker_interest"
        | "judge_interest"
        | "recruiting_relationship"
        | "not_a_fit"
      crm_status:
        | "not_started"
        | "researching"
        | "queued_for_outreach"
        | "contacted"
        | "in_conversation"
        | "meeting_scheduled"
        | "proposal_sent"
        | "won"
        | "lost"
        | "dormant"
        | "do_not_contact"
      crm_task_status: "open" | "in_progress" | "done" | "cancelled"
      crm_tier_priority: "tier_1" | "tier_2" | "tier_3"
      crm_warmth: "cold" | "warm" | "hot"
      doc_visibility: "public" | "members" | "board" | "admin"
      drill_cohort: "software" | "hardware" | "mechanical" | "ops"
      drill_difficulty: "easy" | "medium" | "hard" | "expert"
      drill_source: "seeded" | "ai_generated" | "admin_created"
      drill_status: "draft" | "pending_review" | "published" | "archived"
      drill_type:
        | "multiple_choice"
        | "short_answer"
        | "scenario"
        | "prioritization"
        | "debugging"
        | "design_critique"
        | "mini_case"
      event_type:
        | "workshop"
        | "meeting"
        | "competition"
        | "social"
        | "presentation"
        | "other"
        | "cohort_meeting"
        | "all_hands"
        | "project_meeting"
      lead_stage:
        | "new"
        | "contacted"
        | "scoping"
        | "proposed"
        | "signed"
        | "active"
        | "completed"
        | "lost"
      member_status: "active" | "inactive" | "suspended" | "alumni"
      message_type:
        | "message"
        | "update"
        | "blocker"
        | "decision"
        | "action"
        | "review_request"
        | "help_request"
        | "announcement"
        | "fyi"
      milestone_status: "not_started" | "in_progress" | "completed" | "overdue"
      opportunity_status:
        | "intake"
        | "evaluating"
        | "approved"
        | "active"
        | "declined"
        | "completed"
        | "deferred"
      opportunity_type: "competition" | "contract"
      project_mode:
        | "training_mock"
        | "internal_initiative"
        | "competition"
        | "client_engagement"
        | "sponsor_deliverable"
      project_status: "draft" | "active" | "on_hold" | "completed" | "archived"
      purpose_phase:
        | "thesis"
        | "research"
        | "development"
        | "validation"
        | "knowledge_transfer"
        | "roadmap_update"
      role_request_status: "pending" | "approved" | "rejected"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status: "todo" | "in_progress" | "review" | "done"
      visibility_scope: "internal_only" | "client_visible" | "mixed"
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
        "applicant",
        "member",
        "project_consultant",
        "project_lead",
        "board_member",
        "admin",
        "superadmin",
        "advisor",
        "president",
        "director_of_projects",
        "outreach_lead",
      ],
      approval_status: [
        "pending",
        "approved",
        "rejected",
        "revision_requested",
      ],
      crm_activity_type: [
        "email_sent",
        "follow_up_sent",
        "linkedin_message",
        "phone_call",
        "meeting",
        "research_note",
        "internal_note",
        "status_change",
        "task_completed",
      ],
      crm_conversion_type: [
        "project_inquiry",
        "sponsor_interest",
        "speaker_interest",
        "judge_interest",
        "recruiting_relationship",
        "not_a_fit",
      ],
      crm_status: [
        "not_started",
        "researching",
        "queued_for_outreach",
        "contacted",
        "in_conversation",
        "meeting_scheduled",
        "proposal_sent",
        "won",
        "lost",
        "dormant",
        "do_not_contact",
      ],
      crm_task_status: ["open", "in_progress", "done", "cancelled"],
      crm_tier_priority: ["tier_1", "tier_2", "tier_3"],
      crm_warmth: ["cold", "warm", "hot"],
      doc_visibility: ["public", "members", "board", "admin"],
      drill_cohort: ["software", "hardware", "mechanical", "ops"],
      drill_difficulty: ["easy", "medium", "hard", "expert"],
      drill_source: ["seeded", "ai_generated", "admin_created"],
      drill_status: ["draft", "pending_review", "published", "archived"],
      drill_type: [
        "multiple_choice",
        "short_answer",
        "scenario",
        "prioritization",
        "debugging",
        "design_critique",
        "mini_case",
      ],
      event_type: [
        "workshop",
        "meeting",
        "competition",
        "social",
        "presentation",
        "other",
        "cohort_meeting",
        "all_hands",
        "project_meeting",
      ],
      lead_stage: [
        "new",
        "contacted",
        "scoping",
        "proposed",
        "signed",
        "active",
        "completed",
        "lost",
      ],
      member_status: ["active", "inactive", "suspended", "alumni"],
      message_type: [
        "message",
        "update",
        "blocker",
        "decision",
        "action",
        "review_request",
        "help_request",
        "announcement",
        "fyi",
      ],
      milestone_status: ["not_started", "in_progress", "completed", "overdue"],
      opportunity_status: [
        "intake",
        "evaluating",
        "approved",
        "active",
        "declined",
        "completed",
        "deferred",
      ],
      opportunity_type: ["competition", "contract"],
      project_mode: [
        "training_mock",
        "internal_initiative",
        "competition",
        "client_engagement",
        "sponsor_deliverable",
      ],
      project_status: ["draft", "active", "on_hold", "completed", "archived"],
      purpose_phase: [
        "thesis",
        "research",
        "development",
        "validation",
        "knowledge_transfer",
        "roadmap_update",
      ],
      role_request_status: ["pending", "approved", "rejected"],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["todo", "in_progress", "review", "done"],
      visibility_scope: ["internal_only", "client_visible", "mixed"],
    },
  },
} as const
