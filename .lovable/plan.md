
## PEC Nexus Launch Hardening Sprint

### Phase 1: Data & Security Foundation
1. **Wire public intake form** — save leads to DB, show in CRM, validate fields, remove placeholder setTimeout
2. **Harden onboarding trigger** — verify identity_status updates, conflict routing, PM/Lead role grants
3. **Fix channel seeding** — ensure all required org channels exist (board, pms, tech-leads, cohort channels, announcements)

### Phase 2: Core Workflows
4. **Build Invite Management Center** — admin can issue, resend, expire invites; see pending/accepted/expired states
5. **Build PM/Tech Lead Leadership Workspace** — unified control plane with stage readiness, review queue, blockers, deliverable owners, meeting planning
6. **Build Presidential Terminal** — club-wide health dashboard, cohort-by-cohort status, operational issues, quick actions
7. **Refine Mission Control** — "Your Next Move" with reasons, due-soon items, review feedback, blockers, quick resume

### Phase 3: UX Polish
8. **Simplify document workflow** — intent-based import with smart inference and confirmation sheet
9. **Improve scheduling UX** — obvious conflict marking, recommendation explanations, PM proposal actions
10. **Expand Permission Inspector** — inspect users, projects, channels, documents with access explanations

### Phase 4: Verification
11. **Route protection audit** — verify all /app routes check auth + roles appropriately
12. **Final acceptance test pass** — verify all critical flows work end-to-end
