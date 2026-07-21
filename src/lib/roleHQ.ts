// Role HQ playbooks. One entry per position in the club, so every person who
// signs in sees exactly what their job is, what they do this week, what they
// may decide alone, what they must escalate, and which tabs/channels are
// theirs. Decision rights and cadence mirror the PEC operating documents
// (club structure + workflow/quality-gate specs).

// Season-one curation (2026-07-14 audit): modules with zero recorded usage
// and no role in the one-team relaunch are parked. Routes stay alive so deep
// links and history work; they leave the nav and show an off-season notice.
// Reactivate by removing the entry when the season needs it.
export const SEASON_ONE_PARKED: { url: string; reason: string }[] = [
  { url: "/app/purpose", reason: "Purpose tracks: 0 records ever; year one has one purpose, the client engagement" },
  { url: "/app/competitions", reason: "Competitions: 0 records; not in the fall model" },
  { url: "/app/academy", reason: "Academy courses: 0 records; Training (drills) is the live learning surface" },
  { url: "/app/opportunities", reason: "Opportunities board: 0 records; CRM is the pipeline of record" },
  { url: "/app/grind", reason: "Gamification: near-zero usage; year one culture is real artifacts, not points" },
  { url: "/app/skills", reason: "Skill dashboard: parked with grind until training data justifies it" },
  { url: "/app/ask", reason: "Ask Nexus: 0 queries ever logged; resurfaces when the vault has season data" },
]

export function parkedReason(pathname: string): string | null {
  const hit = SEASON_ONE_PARKED.find((p) => pathname === p.url || pathname.startsWith(p.url + "/"))
  return hit ? hit.reason : null
}

// Routes an applicant is allowed to open. Everything else under /app is
// member-and-up; an applicant who types the URL is bounced to their HQ so
// they never land on a page that is not theirs (RLS already blocks the
// data; this closes the confusing-empty-page gap).
// Exact index route plus prefix-matched sections. "/app" must match exactly,
// or its "/app/" prefix would swallow every member route.
const APPLICANT_ALLOWED_PREFIXES = ["/app/events", "/app/settings"]

export function isApplicantAllowed(pathname: string): boolean {
  if (pathname === "/app") return true
  return APPLICANT_ALLOWED_PREFIXES.some((a) => pathname === a || pathname.startsWith(a + "/"))
}

export interface HQResource {
  title: string;
  url: string;
  desc: string;
}

export interface HQPlaybook {
  key: string;
  title: string;
  mission: string;
  weekly: string[];
  canDecide: string[];
  mustEscalate: string[];
  escalateTo: string;
  resources: HQResource[];
  navPriority: string[]; // sidebar urls in the order this role works
}

const MEMBER_RESOURCES: HQResource[] = [
  { title: "Cohort Hub", url: "/app/cohort", desc: "Your craft home: cohort team, training track, and certification" },
  { title: "Re-commitment", url: "/app/recommit", desc: "Fall 2026 re-formation: claim your seat, go alumni, or step away" },
  { title: "Projects", url: "/app/projects", desc: "Your workstream, deliverables, and gate timeline" },
  { title: "Messages", url: "/app/messages", desc: "Team channels. Blockers go here early, not on Friday" },
  { title: "Training", url: "/app/training", desc: "Skill modules tied to your cohort" },
  { title: "Documents", url: "/app/docs", desc: "Templates: charter, status update, QA checklist" },
];

export const PLAYBOOKS: Record<string, HQPlaybook> = {
  applicant: {
    key: "applicant",
    title: "Applicant",
    mission: "Show us how you think. The application is scored on reasoning and follow-through, not resume length.",
    weekly: [
      "Finish every section of your application; partial applications are not reviewed",
      "Book an interview slot from Events as soon as invitations open",
      "Attend one info session or open build night before interviews",
      "Prepare one project you can explain end to end: problem, constraints, what you would do differently",
    ],
    canDecide: ["Which cohort you apply to", "What work you showcase"],
    mustEscalate: ["Deadline conflicts or accommodations: email the recruitment team"],
    escalateTo: "Recruitment team",
    resources: [
      { title: "Events", url: "/app/events", desc: "Info sessions and interview slots" },
      { title: "Application status", url: "/app", desc: "Your stage in the pipeline, live" },
    ],
    navPriority: ["/app", "/app/events"],
  },

  member: {
    key: "member",
    title: "Member",
    mission:
      "Deliver your artifact and grow your craft. The contract is simple: one named artifact per sprint, submitted on your project page by Friday of sprint week 2, reviewed by your lead within 48 hours.",
    weekly: [
      "Monday: open Projects, confirm your assigned artifact and its due date; flag now if it is at risk",
      "Post progress and blockers in your team channel before the working session, not after",
      "Submit your artifact on the project page (its card has the submit button); it flows draft, submitted, tech review, approved",
      "If review comes back needs-revision, turn it around within 48 hours; a silent stall is an escalation",
      "Between pushes: one training drill",
    ],
    canDecide: ["Implementation details inside your assigned task", "How you organize your own work"],
    mustEscalate: [
      "Anything that moves a deadline",
      "A technical approach that looks infeasible",
      "Client requests that reach you directly (route to your PM)",
    ],
    escalateTo: "Tech Lead",
    resources: MEMBER_RESOURCES,
    navPriority: ["/app", "/app/projects", "/app/messages", "/app/training", "/app/events"],
  },

  project_consultant: {
    key: "project_consultant",
    title: "Consultant",
    mission: "Senior delivery. Your work is client-visible by default: every artifact you touch should pass the QA checklist without edits.",
    weekly: [
      "Review your workstream against the charter; flag scope drift the week it appears, not at the gate",
      "Pre-check deliverables against the QA checklist: units, assumptions, reproducibility, story clarity",
      "Mentor one newer member on your project for at least 30 minutes",
      "Post progress and blockers before the weekly meeting",
    ],
    canDecide: ["Implementation approach inside your workstream", "Draft structure of client-facing artifacts"],
    mustEscalate: ["Scope drift", "Timeline risk", "Anything touching NDA/IP or sensitive client data"],
    escalateTo: "Tech Lead, then PM",
    resources: MEMBER_RESOURCES,
    navPriority: ["/app", "/app/projects", "/app/messages", "/app/training"],
  },

  project_lead: {
    key: "project_lead",
    title: "Tech Lead",
    mission: "Own technical correctness. Nothing passes a gate with your name on it unless it is right, reproducible, and honest about its limits.",
    weekly: [
      "Triage every blocker in the team channel within 24 hours",
      "Review the week's deliverables against the QA checklist before they reach the PM",
      "Check gate readiness: next gate, what is missing, who owns it",
      "Confirm the technical approach is still feasible; saying so late is an escalation trigger",
      "Review action-log hygiene: every item has an owner and a date",
    ],
    canDecide: [
      "Technical approach, tools, and architecture within scope",
      "QA acceptance or rejection of technical deliverables",
    ],
    mustEscalate: [
      "Approach proves infeasible",
      "Scope change adding more than ~15% workload",
      "Two consecutive missed internal deadlines on your project",
    ],
    escalateTo: "PM, then Vice President",
    resources: [
      { title: "Lead Workspace", url: "/app/lead", desc: "Your review queue, gate checklists, team health" },
      { title: "Review Queue", url: "/app/review", desc: "Deliverables waiting on your QA call" },
      { title: "Projects", url: "/app/projects", desc: "Every project you lead, with gate timelines" },
      { title: "Messages", url: "/app/messages", desc: "Team channels; blocker triage lives here" },
      { title: "Documents", url: "/app/docs", desc: "QA checklist, gate templates, charter" },
    ],
    navPriority: ["/app", "/app/lead", "/app/projects", "/app/messages", "/app/scheduling"],
  },

  cohort_lead: {
    key: "cohort_lead",
    title: "Cohort Lead",
    mission:
      "Run your cohort as a craft home. You train the function, certify who is ready, and keep a bench of staffable members. Your cohort is where 'what do I do this week' always gets answered; you are the person who answers it.",
    weekly: [
      "Run the weekly cohort meeting: a training block, the cohort's line work, and who is newly staffable",
      "Move every un-certified member one step along the onboarding track; certify anyone who cleared their First Unit",
      "Keep the staffable roster current so the pod can be staffed from certified members, not guesses",
      "Check member health: nobody silent, nobody stuck; surface anyone at risk",
      "Post the cohort's blockers and staffing gaps to leadership before the weekly sync",
    ],
    canDecide: [
      "Cohort meeting cadence, training focus, and drill assignments",
      "Certification: whether a member has cleared their First Unit and is staffable",
      "Internal cohort task and shadow assignments",
    ],
    mustEscalate: [
      "A member who should be moved off the bench or off the roster",
      "Staffing shortfalls that put a pod at risk",
      "Anything requiring a new leadership seat or a scope call",
    ],
    escalateTo: "Vice President / President",
    resources: [
      { title: "Cohort Hub", url: "/app/cohort", desc: "Your cohort: roster, onboarding track, certification, assembly line" },
      { title: "Training", url: "/app/training", desc: "The drills and modules your cohort runs" },
      { title: "Members", url: "/app/members", desc: "Roster, roles, and who is where" },
      { title: "Messages", url: "/app/messages", desc: "Your cohort channel; blockers surface here first" },
      { title: "Scheduling", url: "/app/scheduling", desc: "Cohort meeting and working-session times" },
    ],
    navPriority: ["/app", "/app/cohort", "/app/messages", "/app/training", "/app/scheduling"],
  },

  board_member: {
    key: "board_member",
    title: "VP / Board",
    mission:
      "Year one: run the delivery machine. Sprint planning, working sessions, QA, and member accountability are yours. Amogh handles the outside; you make the inside undeniable.",
    weekly: [
      "Plan the sprint: every member has a named artifact with a date",
      "Run the working session from the generated agenda; every meeting ends with assigned actions",
      "Review artifacts against the QA checklist before anything is client-visible",
      "Keep the attendance and delivery ledger current; two unexcused absences triggers the waitlist rule",
      "Send the weekly written client status (draft generated from sprint state; edit, never write from scratch)",
    ],
    canDecide: [
      "Task assignments, internal deadlines, meeting cadence",
      "Day-to-day client communication",
      "Minor deliverable formatting",
    ],
    mustEscalate: [
      "Accepting or rejecting a client project (VP + President)",
      "Scope changes above ~15% workload",
      "Timeline changes that move final delivery",
      "Anything involving NDAs, IP, or sensitive data",
    ],
    escalateTo: "Vice President / President",
    resources: [
      { title: "Company Relations", url: "/app/crm", desc: "Pipeline, contacts, contracts, next actions" },
      { title: "Projects", url: "/app/projects", desc: "Portfolio view with gate and check-in status" },
      { title: "Recruitment", url: "/app/recruitment", desc: "Applicant pipeline and cohort planning" },
      { title: "Analytics", url: "/app/analytics", desc: "Delivery and engagement metrics" },
      { title: "Announcements", url: "/app/announcements", desc: "Club-wide comms" },
    ],
    navPriority: ["/app", "/app/crm", "/app/projects", "/app/recruitment", "/app/messages"],
  },

  admin: {
    key: "admin",
    title: "President / Admin",
    mission:
      "Year one: land the client, own the outside. You sign the fall client, run every external conversation, and make the final calls. Sam runs delivery; you two never overlap.",
    weekly: [
      "Move the fall client pipeline: every open conversation gets a next action this week (signed by mid-August)",
      "Decide every inquiry sitting at accept/reshape/decline; nothing waits more than a week",
      "Review the escalation queue and anything touching NDA, IP, safety, or liability",
      "Check recruiting readiness against the runway (WOW showcase Aug 18-19, apps close Sep 4)",
      "Log every decision you and Sam make in the Decision Log; year one sets the precedents",
    ],
    canDecide: ["Client acceptance (with VP)", "High-risk and dispute calls", "External representation"],
    mustEscalate: ["Legal exposure beyond club policy: advisor / university"],
    escalateTo: "Faculty advisor / ASI",
    resources: [
      { title: "Re-commitment tracker", url: "/app/recommit", desc: "Live stay/alumni/leave counts for the re-formation" },
      { title: "QR Studio", url: "/app/qr", desc: "Print-ready QR codes with source tracking for flyers and booths" },
      { title: "Command Center", url: "/app/command", desc: "Org-wide state at a glance" },
      { title: "Admin Console", url: "/app/admin", desc: "Roles, invites, metrics, configuration" },
      { title: "Company Relations", url: "/app/crm", desc: "Pipeline with decision queue" },
      { title: "Recruitment", url: "/app/recruitment", desc: "Leadership view of cohort building" },
      { title: "Announcements", url: "/app/announcements", desc: "Club-wide comms" },
    ],
    navPriority: ["/app", "/app/command", "/app/crm", "/app/recruitment", "/app/admin"],
  },

  treasurer: {
    key: "treasurer",
    title: "Treasurer",
    mission:
      "Own the club's money. Keep dues collected, the budget honest, and every dollar accounted for, so the club can fund what it needs and unlock ASI matching when it matters.",
    weekly: [
      "Track dues: who has paid, who is due, who has a waiver; nudge the unpaid before the deadline",
      "Keep the budget current: log income and expenses, flag anything off-plan",
      "Review and route spending requests; keep receipts",
      "Report the balance and burn to the board at the weekly sync",
    ],
    canDecide: ["Routine reimbursements within the approved budget", "Dues waivers for members who ask"],
    mustEscalate: [
      "Spending above the approved budget line",
      "Anything involving contracts or outside accounts",
      "Sponsor or grant funds coming in",
    ],
    escalateTo: "President",
    resources: [
      { title: "Members", url: "/app/members", desc: "The roster, for dues tracking" },
      { title: "Documents", url: "/app/docs", desc: "Budget and financial records" },
    ],
    navPriority: ["/app", "/app/members", "/app/docs"],
  },

  advisor: {
    key: "advisor",
    title: "Advisor",
    mission: "Outside eyes on the work. You review gate materials and tell us what a client or faculty member would actually think.",
    weekly: [
      "Review anything in your portal queue: midpoint decks, final QA materials",
      "Flag technical or professional risks the team is too close to see",
      "Hold posted office hours or respond to scheduled asks",
    ],
    canDecide: ["Advisory recommendations; teams decide whether to adopt"],
    mustEscalate: ["Safety, liability, or integrity concerns go straight to the President"],
    escalateTo: "President",
    resources: [
      { title: "Advisor Portal", url: "/app/advisor", desc: "Your review queue and project summaries" },
      { title: "Events", url: "/app/events", desc: "Gate reviews and presentations" },
    ],
    navPriority: ["/app", "/app/advisor", "/app/events"],
  },

  alumni: {
    key: "alumni",
    title: "Alumni",
    mission: "Stay in the loop, open doors. One referral or one mock interview a semester keeps the flywheel turning.",
    weekly: [
      "Nothing is required of you. When you have 20 minutes: refer a company, review a resume, or take a coffee chat",
      "Update your profile so members can find you by company and domain",
      "RSVP to alumni events when they post",
    ],
    canDecide: ["How and when you engage"],
    mustEscalate: [],
    escalateTo: "Ops team",
    resources: [
      { title: "Members", url: "/app/members", desc: "The current roster; find your successors" },
      { title: "Events", url: "/app/events", desc: "Showcases and alumni nights" },
      { title: "Messages", url: "/app/messages", desc: "Alumni channel" },
    ],
    navPriority: ["/app", "/app/events", "/app/members"],
  },
};

export function selectPlaybook(opts: {
  highestRole: string;
  isAdmin: boolean;
  isCohortLead?: boolean;
  memberStatus?: string | null;
}): HQPlaybook {
  if (opts.memberStatus === "alumni") return PLAYBOOKS.alumni;
  if (opts.isAdmin) return PLAYBOOKS.admin;
  // Org leadership (board/president) outranks a scoped cohort-lead hat.
  if (opts.highestRole === "board_member" || opts.highestRole === "president") {
    return PLAYBOOKS[opts.highestRole] ?? PLAYBOOKS.board_member;
  }
  // A member or consultant who leads their cohort works from the cohort-lead HQ.
  if (opts.isCohortLead) return PLAYBOOKS.cohort_lead;
  return PLAYBOOKS[opts.highestRole] ?? PLAYBOOKS.member;
}

/** ISO week key so weekly checklist state resets every Monday. */
export function weekKey(now = new Date()): string {
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-w${week}`;
}
