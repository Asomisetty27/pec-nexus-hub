// Role HQ playbooks. One entry per position in the club, so every person who
// signs in sees exactly what their job is, what they do this week, what they
// may decide alone, what they must escalate, and which tabs/channels are
// theirs. Decision rights and cadence mirror the PEC operating documents
// (club structure + workflow/quality-gate specs).

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
  { title: "Projects", url: "/app/projects", desc: "Your workstream, deliverables, and gate timeline" },
  { title: "Messages", url: "/app/messages", desc: "Team channels. Blockers go here early, not on Friday" },
  { title: "Training", url: "/app/training", desc: "Skill modules tied to your cohort" },
  { title: "Ask Nexus", url: "/app/ask", desc: "Ask the club brain before you ask a human" },
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
    mission: "Deliver your workstream and grow your craft. Your lead owns correctness; you own momentum and honesty about blockers.",
    weekly: [
      "Check your action items Monday; recommit or flag anything you cannot hit",
      "Post progress and blockers in your team channel before the weekly meeting",
      "Send your 2-minute status to your lead before Friday",
      "Log every decision that changes the work in the project Decision Log",
      "Complete one training module if your project is between pushes",
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
    escalateTo: "PM, then VP Projects",
    resources: [
      { title: "Lead Workspace", url: "/app/lead", desc: "Your review queue, gate checklists, team health" },
      { title: "Review Queue", url: "/app/review", desc: "Deliverables waiting on your QA call" },
      { title: "Projects", url: "/app/projects", desc: "Every project you lead, with gate timelines" },
      { title: "Messages", url: "/app/messages", desc: "Team channels; blocker triage lives here" },
      { title: "Documents", url: "/app/docs", desc: "QA checklist, gate templates, charter" },
    ],
    navPriority: ["/app", "/app/lead", "/app/projects", "/app/messages", "/app/scheduling"],
  },

  board_member: {
    key: "board_member",
    title: "Board / PM / VP",
    mission: "Pipeline health and delivery consistency. You are the client's single point of contact and the club's early-warning system.",
    weekly: [
      "Verify every active project filed a check-in this week; chase the ones that did not",
      "Send the weekly written status to every client, even in no-meeting weeks",
      "Scan escalation triggers: client silent over 7 days, scope growth over 15%, two missed deadlines",
      "Move CRM pipeline: every open inquiry gets a next action and an owner",
      "Review staffing: anyone overloaded, anyone idle",
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
    escalateTo: "VP Projects / President",
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
    mission: "External credibility, final approvals, high-risk calls. Everything that can embarrass the club in public crosses your desk first.",
    weekly: [
      "Decide every inquiry sitting at accept/reshape/decline; nothing waits more than a week",
      "Review act-now escalations across the portfolio",
      "Check the three acquisition lanes: cold outreach, partnerships, referrals",
      "Confirm next cycle's pipeline is on schedule (fall signed by June, spring by November)",
      "Review anything touching NDA, IP, safety, or liability",
    ],
    canDecide: ["Client acceptance (with VP)", "High-risk and dispute calls", "External representation"],
    mustEscalate: ["Legal exposure beyond club policy: advisor / university"],
    escalateTo: "Faculty advisor / ASI",
    resources: [
      { title: "Command Center", url: "/app/command", desc: "Org-wide state at a glance" },
      { title: "Admin Console", url: "/app/admin", desc: "Roles, invites, metrics, configuration" },
      { title: "Company Relations", url: "/app/crm", desc: "Pipeline with decision queue" },
      { title: "Recruitment", url: "/app/recruitment", desc: "Leadership view of cohort building" },
      { title: "Announcements", url: "/app/announcements", desc: "Club-wide comms" },
    ],
    navPriority: ["/app", "/app/command", "/app/crm", "/app/recruitment", "/app/admin"],
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
  memberStatus?: string | null;
}): HQPlaybook {
  if (opts.memberStatus === "alumni") return PLAYBOOKS.alumni;
  if (opts.isAdmin) return PLAYBOOKS.admin;
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
