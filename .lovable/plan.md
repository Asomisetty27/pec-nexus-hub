

## PEC Nexus — MVP Implementation Plan

### Brand Identity (Extracted from Logo)
- **Primary (Deep Teal):** `#1A3C34` — gears, headings, CTAs
- **Secondary (Forest):** `#2D5A4E` — hover states, secondary actions
- **Accent (Gold):** `#C4A24E` — badges, highlights, status indicators
- **Background (Cream):** `#F5F1E3` — light mode base
- **Surface (White):** `#FEFDFB` — cards, modals
- **Muted:** `#E8E2D4` — borders, dividers
- **Dark mode:** inverted with `#0F1F1B` background, cream text
- **Semantic:** Success `#2E7D5B`, Warning `#D4A017`, Danger `#C0392B`

Design tokens applied globally via CSS variables with light/dark mode support.

---

### What We're Building (5 MVP Modules)

#### Module A: Public Marketing Site
- **Landing page** with hero, services grid, "Work with PEC" intake form
- **About/Services** page with case study cards
- **Sponsor wall** showing tier-based logos
- Clean navigation with CTA to sign up or submit a project inquiry

#### Module B: Auth & Onboarding (Supabase)
- **Sign up** with Cal Poly email domain validation (`@calpoly.edu`)
- **Email verification** flow via Supabase Auth
- **Role selection** screen (Member, Applicant, etc.)
- **Admin approval** queue for elevated roles
- **Onboarding checklist** shown on first login per role
- Supabase database tables: `profiles`, `user_roles` (enum-based RBAC), `role_requests`, `audit_logs`
- RLS policies enforcing role-based access throughout

#### Module C: Personal Dashboard
- **My Projects** cards with status, role, and next deadline
- **My Tasks** list (upcoming + overdue)
- **Announcements** feed from admin
- **Quick Actions** (create task, view schedule, upload file)
- Role-adaptive layout: members see projects, admins see org health metrics

#### Module D: Project OS (Core)
- **Project overview** page with scope, timeline, team roster
- **Task board** — Kanban columns (To Do, In Progress, Review, Done) + list toggle
- **Milestones** tracker with progress bars
- **Deliverables** list with file upload, versioning, and client visibility toggle
- **Team roster** with role badges
- DB tables: `projects`, `project_memberships`, `tasks`, `milestones`, `deliverables`, `files`
- RLS: project data visible only to project members + admins

#### Module E: Admin Console
- **User verification** queue — approve/reject pending signups
- **Role management** — assign/revoke roles with audit logging
- **Project management** — create projects, assign leads
- **Audit log viewer** — searchable log of all role changes, project invitations, permission changes

---

### Database Schema (Supabase/Postgres)
Core tables with RLS:
- `profiles` (id, user_id FK, full_name, avatar_url, bio, skills, cal_poly_email, verified)
- `user_roles` (id, user_id FK, role enum, granted_by, granted_at)
- `role_requests` (id, user_id, requested_role, status, reviewer_id, reviewed_at)
- `projects` (id, name, description, status, client_name, start_date, end_date, created_by)
- `project_memberships` (id, project_id FK, user_id FK, role_on_project)
- `tasks` (id, project_id FK, title, description, status, assignee_id, priority, due_date)
- `milestones` (id, project_id FK, title, due_date, status, progress)
- `deliverables` (id, project_id FK, milestone_id, title, file_url, version, client_visible)
- `announcements` (id, title, body, author_id, created_at, pinned)
- `audit_logs` (id, user_id, action, target_type, target_id, metadata, created_at)

Role enum: `visitor, applicant, member, project_consultant, project_lead, board_member, admin, superadmin`

Security definer function `has_role()` for RLS policies (no recursive checks).

---

### Key Screens (MVP)
1. Landing page (hero + services + CTA)
2. Sign up form (email validation)
3. Email verification pending screen
4. Role selection screen
5. Onboarding checklist
6. Personal dashboard
7. Project list view
8. Project detail / overview
9. Task board (Kanban)
10. Task detail modal
11. Milestones view
12. Deliverables list with upload
13. Admin: user verification queue
14. Admin: role management
15. Admin: project creation form
16. Admin: audit log viewer
17. Sponsor wall page
18. "Work with PEC" intake form
19. 404 / Not Found
20. Settings / profile page

---

### Design System Components
Built with Tailwind + PEC tokens: Button (primary/secondary/ghost/destructive), Card, StatusPill, MetricTile, Sidebar navigation, TopBar, Avatar with role badge, KanbanColumn, TaskCard, MilestoneBar, FileUploadDropzone, DataTable, Modal/Dialog, Announcement card, Checklist, Form inputs — all in PEC brand colors with dark mode support.

---

### Implementation Order (Sprint Plan)
1. **Design system + tokens + layout shell** (sidebar, topbar, routing)
2. **Supabase setup** — auth, profiles, user_roles, RLS policies
3. **Public pages** — landing, services, sponsor wall, intake form
4. **Auth flow** — signup, email verify, role selection, onboarding
5. **Dashboard** — project cards, tasks, announcements
6. **Project OS** — project pages, Kanban, milestones, deliverables
7. **Admin console** — user queue, role management, audit logs
8. **Polish** — dark mode, responsive, loading states, error handling

