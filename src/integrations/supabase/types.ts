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
          created_by: string
          description: string | null
          id: string
          is_org_wide: boolean
          name: string
          project_id: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_org_wide?: boolean
          name: string
          project_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
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
      deliverables: {
        Row: {
          approved: boolean
          approved_at: string | null
          approved_by: string | null
          client_visible: boolean
          created_at: string
          created_by: string
          description: string | null
          file_url: string | null
          id: string
          milestone_id: string | null
          project_id: string
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          client_visible?: boolean
          created_at?: string
          created_by: string
          description?: string | null
          file_url?: string | null
          id?: string
          milestone_id?: string | null
          project_id: string
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          client_visible?: boolean
          created_at?: string
          created_by?: string
          description?: string | null
          file_url?: string | null
          id?: string
          milestone_id?: string | null
          project_id?: string
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
        ]
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
          project_id: string
          role_on_project: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          project_id: string
          role_on_project?: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
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
          scope: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
        }
        Insert: {
          client_org_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          scope?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Update: {
          client_org_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          scope?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_board_or_admin: { Args: { _user_id: string }; Returns: boolean }
      is_channel_member: {
        Args: { _channel_id: string; _user_id: string }
        Returns: boolean
      }
      is_project_member: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
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
      message_type: "message" | "update" | "blocker" | "decision" | "action"
      milestone_status: "not_started" | "in_progress" | "completed" | "overdue"
      project_status: "draft" | "active" | "on_hold" | "completed" | "archived"
      role_request_status: "pending" | "approved" | "rejected"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status: "todo" | "in_progress" | "review" | "done"
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
      message_type: ["message", "update", "blocker", "decision", "action"],
      milestone_status: ["not_started", "in_progress", "completed", "overdue"],
      project_status: ["draft", "active", "on_hold", "completed", "archived"],
      role_request_status: ["pending", "approved", "rejected"],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["todo", "in_progress", "review", "done"],
    },
  },
} as const
