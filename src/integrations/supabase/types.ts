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
        Relationships: []
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
        ]
      }
      channels: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_org_wide: boolean
          name: string
          project_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_org_wide?: boolean
          name: string
          project_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_org_wide?: boolean
          name?: string
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channels_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
        }
        Relationships: []
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
          decided_at: string
          decided_by: string
          id: string
          project_id: string
          rationale: string | null
          reference_links: string | null
          title: string
        }
        Insert: {
          decided_at?: string
          decided_by: string
          id?: string
          project_id: string
          rationale?: string | null
          reference_links?: string | null
          title: string
        }
        Update: {
          decided_at?: string
          decided_by?: string
          id?: string
          project_id?: string
          rationale?: string | null
          reference_links?: string | null
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
          capacity: number | null
          created_at: string
          created_by: string
          description: string | null
          end_time: string | null
          event_type: Database["public"]["Enums"]["event_type"]
          id: string
          is_public: boolean
          location: string | null
          start_time: string
          title: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          created_by: string
          description?: string | null
          end_time?: string | null
          event_type?: Database["public"]["Enums"]["event_type"]
          id?: string
          is_public?: boolean
          location?: string | null
          start_time: string
          title: string
        }
        Update: {
          capacity?: number | null
          created_at?: string
          created_by?: string
          description?: string | null
          end_time?: string | null
          event_type?: Database["public"]["Enums"]["event_type"]
          id?: string
          is_public?: boolean
          location?: string | null
          start_time?: string
          title?: string
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
          contact_email: string | null
          contact_name: string
          contact_phone: string | null
          created_at: string
          id: string
          notes: string | null
          org_id: string | null
          source: string | null
          stage: Database["public"]["Enums"]["lead_stage"]
          updated_at: string
          value: number | null
        }
        Insert: {
          assigned_to?: string | null
          contact_email?: string | null
          contact_name: string
          contact_phone?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          org_id?: string | null
          source?: string | null
          stage?: Database["public"]["Enums"]["lead_stage"]
          updated_at?: string
          value?: number | null
        }
        Update: {
          assigned_to?: string | null
          contact_email?: string | null
          contact_name?: string
          contact_phone?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          org_id?: string | null
          source?: string | null
          stage?: Database["public"]["Enums"]["lead_stage"]
          updated_at?: string
          value?: number | null
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
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
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
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          cal_poly_email: string | null
          created_at: string
          full_name: string
          graduation_year: number | null
          id: string
          invite_state: string
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
          avatar_url?: string | null
          bio?: string | null
          cal_poly_email?: string | null
          created_at?: string
          full_name?: string
          graduation_year?: number | null
          id?: string
          invite_state?: string
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
          avatar_url?: string | null
          bio?: string | null
          cal_poly_email?: string | null
          created_at?: string
          full_name?: string
          graduation_year?: number | null
          id?: string
          invite_state?: string
          linkedin_url?: string | null
          major?: string | null
          onboarding_completed?: boolean
          phone?: string | null
          skills?: string[] | null
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
            foreignKeyName: "projects_client_org_id_fkey"
            columns: ["client_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: []
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
      create_project_from_template: {
        Args: {
          p_cohort_id?: string
          p_description?: string
          p_name: string
          p_template_id: string
        }
        Returns: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_advisor: { Args: { _user_id: string }; Returns: boolean }
      is_board_or_admin: { Args: { _user_id: string }; Returns: boolean }
      is_channel_member: {
        Args: { _channel_id: string; _user_id: string }
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
      reject_deliverable: {
        Args: { p_deliverable_id: string; p_reason: string }
        Returns: undefined
      }
      request_deliverable_changes: {
        Args: { p_deliverable_id: string; p_reason: string }
        Returns: undefined
      }
      seed_project_memberships_from_cohort: {
        Args: { p_cohort_id: string; p_project_id: string }
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
      approval_status:
        | "pending"
        | "approved"
        | "rejected"
        | "revision_requested"
      doc_visibility: "public" | "members" | "board" | "admin"
      event_type:
        | "workshop"
        | "meeting"
        | "competition"
        | "social"
        | "presentation"
        | "other"
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
      ],
      approval_status: [
        "pending",
        "approved",
        "rejected",
        "revision_requested",
      ],
      doc_visibility: ["public", "members", "board", "admin"],
      event_type: [
        "workshop",
        "meeting",
        "competition",
        "social",
        "presentation",
        "other",
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
