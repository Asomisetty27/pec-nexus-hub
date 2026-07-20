// Every signed-in perspective must resolve to a playbook that tells the
// person what to do: mission, weekly duties, decision rights, rooms.
import { describe, expect, it } from "vitest";
import { PLAYBOOKS, SEASON_ONE_PARKED, parkedReason, selectPlaybook, weekKey } from "@/lib/roleHQ";

const PERSPECTIVES = [
  { name: "applicant", opts: { highestRole: "applicant", isAdmin: false }, expected: "applicant" },
  { name: "member", opts: { highestRole: "member", isAdmin: false }, expected: "member" },
  { name: "consultant", opts: { highestRole: "project_consultant", isAdmin: false }, expected: "project_consultant" },
  { name: "tech lead", opts: { highestRole: "project_lead", isAdmin: false }, expected: "project_lead" },
  { name: "cohort lead", opts: { highestRole: "member", isAdmin: false, isCohortLead: true }, expected: "cohort_lead" },
  { name: "board outranks cohort-lead hat", opts: { highestRole: "board_member", isAdmin: false, isCohortLead: true }, expected: "board_member" },
  { name: "VP / board", opts: { highestRole: "board_member", isAdmin: false }, expected: "board_member" },
  { name: "treasurer", opts: { highestRole: "treasurer", isAdmin: false }, expected: "treasurer" },
  { name: "president / admin", opts: { highestRole: "admin", isAdmin: true }, expected: "admin" },
  { name: "superadmin", opts: { highestRole: "superadmin", isAdmin: true }, expected: "admin" },
  { name: "advisor", opts: { highestRole: "advisor", isAdmin: false }, expected: "advisor" },
  {
    name: "alumni (overrides role)",
    opts: { highestRole: "member", isAdmin: false, memberStatus: "alumni" },
    expected: "alumni",
  },
  { name: "unknown role falls back to member", opts: { highestRole: "mystery", isAdmin: false }, expected: "member" },
] as const;

describe("selectPlaybook covers every perspective", () => {
  for (const p of PERSPECTIVES) {
    it(p.name, () => {
      expect(selectPlaybook(p.opts).key).toBe(p.expected);
    });
  }
});

describe("every playbook is complete", () => {
  for (const [key, pb] of Object.entries(PLAYBOOKS)) {
    it(`${key} tells the person what to do`, () => {
      expect(pb.mission.length).toBeGreaterThan(20);
      expect(pb.weekly.length).toBeGreaterThan(0);
      expect(pb.canDecide.length).toBeGreaterThan(0);
      expect(pb.escalateTo.length).toBeGreaterThan(0);
      expect(pb.resources.length).toBeGreaterThan(0);
      for (const r of pb.resources) expect(r.url).toMatch(/^\/app/);
      expect(pb.navPriority.length).toBeGreaterThan(0);
    });
  }
});

describe("season-one curation", () => {
  it("no playbook resource or nav priority points at a parked module", () => {
    const parked = SEASON_ONE_PARKED.map((p) => p.url);
    for (const pb of Object.values(PLAYBOOKS)) {
      for (const r of pb.resources) expect(parked).not.toContain(r.url);
      for (const u of pb.navPriority) expect(parked).not.toContain(u);
    }
  });
  it("parkedReason matches parked paths and subpaths only", () => {
    expect(parkedReason("/app/grind")).toBeTruthy();
    expect(parkedReason("/app/grind/admin")).toBeTruthy();
    expect(parkedReason("/app/projects")).toBeNull();
  });
});

describe("weekKey", () => {
  it("is stable within a week and changes across weeks", () => {
    expect(weekKey(new Date("2026-09-22T10:00:00Z"))).toBe(weekKey(new Date("2026-09-24T18:00:00Z")));
    expect(weekKey(new Date("2026-09-22T10:00:00Z"))).not.toBe(weekKey(new Date("2026-09-29T10:00:00Z")));
  });
});
