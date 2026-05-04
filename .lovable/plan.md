# Ops Cohort Operating Surface — Audit + Plan

This is the Phase X1 audit + the surgical Phase X2–X5 plan. No code yet. After approval I implement in tight phased commits with reports.

---

## Phase X1 — What already exists

**Schema (live, verified):**
- `organizations` has the full ownership + ops vocabulary: `owner_user_id`, `secondary_owner_user_id`, `overseeing_lead_user_id`, `crm_status` (11-value enum), `relationship_goal`, `warmth_score`, `tier_priority`, `last_contacted_at`, `next_action_at`, fit scores, plus Phase C enrichment fields (`enrichment_confidence`, `procurement_vendor`, `last_enriched_at`, `contract_monitor_notes`).
- `company_contacts`, `company_tasks`, `company_activities`, `company_conversions` exist with proper indexes (per-org email uniqueness, single primary contact).
- `public_contract_opportunities`, `organization_enrichment_sources`, `contract_monitor_runs` exist from Phase C.

**Permissions (live RLS, verified):**
- `is_ops_crm_user(uid)` already grants read access to every `Ops / PM` cohort member + outreach_lead + leadership.
- Write policies on `company_activities` / `company_contacts` / `company_tasks` already let any Ops member write when they own/assist/oversee the org **or** when the org is unowned and in an early status. So the access doctrine is already mostly enforced at the DB layer.
- Destructive deletes are leadership-only. Good.
- `resolve_designated_ops_lead()` exists.
- `useCrmAccess` client hook gates on `Ops / PM` cohort membership — already aligned.

**UI surfaces that exist:**
- `CrmLayout` with tabs: Dashboard, Pipeline, My Companies, Table, Contacts, Qualified, Analytics (leadership), Legacy (leadership).
- `CrmDashboard` already renders Active/Qualified/Converted/Hot stats, "Due this week", "Going stale", "Your companies".
- `CompanyDetail` supports inline editing, status changes, contact add, tasks, conversions; already calls `logAuditAction`.
- `LeadWorkspace` already has an Ops branch that points members at CRM and explicitly says Ops doesn't run mock projects.
- A legacy `src/pages/app/CRM.tsx` exists (sponsorship-era pipeline) — **dead** beside the canonical `/app/crm/*` routes.

**Cohort score:** `score.ts` is project-scoped; Ops is not currently scored against deliverables in any meaningful surface (no Ops-as-delivery regression risk found in this pass — confirmed by grep).

---

## Phase X1 — What must change (gap list, ranked)

**Critical clarity gaps (high value, low risk):**
1. No **Unowned queue**, no **Ready for Outreach** queue, no **Needs Research** queue, no **Recently Changed** feed, no **Public Contract Targets** view as first-class tabs. Today these are computed only inside the dashboard or buried in Table filters. Ops members can't "work from a queue all day."
2. No **Claim** action anywhere. Unowned companies just sit there. The schema supports it; the UI doesn't expose it.
3. **Activity log** (`company_activities`) is never read in the UI. There's no "Last touched 2h ago by X" signal on cards or detail. Concurrency safety is invisible.
4. **CompanyDetail** has no activity timeline and no quick "Log activity" action — Ops has nowhere to record outreach without misusing notes.
5. **Public contract opportunities** discovered by Phase C/D have no CRM surface — Ops can't see or act on them.
6. Legacy `src/pages/app/CRM.tsx` is dead but still imported nowhere we've confirmed; should be removed if orphaned.
7. Dashboard "Your companies" doesn't include `overseeing_lead_user_id` records and doesn't show the unowned/recently-changed counts as actionable cards.
8. No collaboration-safety guard: two users can edit the same company without seeing the other's recent activity.

**Out of scope this pass (deliberately):** new presence/realtime system, cohort-score rewrite, notifications, second CRM, schema redesign of `crm_status` enum.

---

## Phase X2 — Access + queue scaffolding (small)

- Remove dead `src/pages/app/CRM.tsx` (confirm no remaining imports first).
- Reuse `CrmLayout`. Compress nav to: **Dashboard · Queues · Pipeline · Companies · Contacts · Contracts · Analytics (leadership)**. ("My Companies", "Table", "Qualified", "Legacy" collapse into Queues + Companies — no functional loss; saved-view chips inside.)
- Add a single `CrmQueues` page with chip-switched saved views, computed client-side from one `organizations` query (avoids N+1):
  - **My** (owner | secondary | overseeing — fixes overseeing gap)
  - **Unowned** (no owner/secondary/overseeing, status ∈ early)
  - **Ready for outreach** (`crm_status = queued_for_outreach` OR status=researching with ≥1 contact)
  - **Needs research** (status ∈ {not_started, researching}, no contacts, or missing industry/website)
  - **Stale** (active status, `last_contacted_at` > 14d or null + not "not_started")
  - **Recently changed** (sorted by `updated_at` desc, last 7d)
  - **Public contract targets** (join `public_contract_opportunities` view)
  - **Tasks due** (from `company_tasks` for me + due ≤ 7d)
- "Companies" replaces "Table" + "Qualified" with the existing CrmTable, retaining its filter querystring so existing links still work.

## Phase X3 — Ownership + concurrency signals (small)

- Add `ClaimButton` on company card + detail header: sets `owner_user_id = auth.uid()` only if all three owner fields are null; toast + audit log.
- Add `ReassignDialog` (leadership-only) on detail.
- Read latest row from `company_activities` per company in batched query; render "Last touched **2h ago by Y**" on `CompanyCard` and at top of `CompanyDetail`.
- Add **Activity Timeline** + **Log activity** quick action on `CompanyDetail` (type ∈ email/call/meeting/note). Writes to `company_activities` (RLS already enforces ownership).
- Stale warning banner on detail when `updated_at` changed by another user since the page loaded (lightweight `select updated_at` re-check on save; if mismatch, prompt before overwrite — no silent overwrites).

## Phase X4 — Contract Monitor integration + self-explanatory UX (small)

- New "Contracts" tab inside CRM lists `public_contract_opportunities` with confidence chip, awardee org link, "Promote to CRM" action that creates/links an `organizations` row (uses existing `cm_write_field_if_better` only for enrichment fields).
- Empty states across queues become **action prompts** ("Nothing unowned. Browse all companies →"), not blank text.
- Add inline 1-line definition under each queue chip ("Companies with no owner, in an early status — claim one to start.").

## Phase X5 — Regression + multi-user verification

- Manual: 2-account smoke (one Ops member, one leadership): claim, log activity, edit, see "last touched by", reassign, promote contract → CRM.
- Automated: confirm recruitment / deliverable / cadence / score routes still mount; build passes; no orphaned imports.
- Report: what changed / what was tested / what failed and was fixed / what is still unproven / what next phase depends on.

---

## Risks / decisions needed before I start

1. **Nav compression** ("My Companies", "Qualified", "Table", "Legacy" merge into **Queues** + **Companies**). This deletes 2 visible tabs (replaces with chips). Confirm OK; otherwise I'll keep all tabs and just add **Queues** + **Contracts**.
2. **Promote-to-CRM** for a contract opportunity creates a real `organizations` row owned by `resolve_designated_ops_lead()` (or unowned if none). Confirm or specify default owner.
3. **Concurrency guard:** I'll use optimistic `updated_at` re-check, not realtime presence. Confirm this is "honest enough."
4. **Cohort score:** I will **not** change Ops scoring this pass (no live system mis-scores Ops today). Confirm deferring.
5. **Legacy file removal:** I'll delete `src/pages/app/CRM.tsx` only if grep confirms zero imports. Confirm OK.

If all five answers are "go," I proceed X2 → X3 → X4 → X5 with a short report after each phase before moving on.
