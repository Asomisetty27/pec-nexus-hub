// Role-by-role access matrix. Every role's nav is derived from the same
// playbook the sidebar and Role HQ use, so this locks the contract:
// each role sees its own rooms, never a parked module, and never a room
// it has no rights to.
import { describe, expect, it } from "vitest";
import { PLAYBOOKS, SEASON_ONE_PARKED, parkedReason, selectPlaybook } from "@/lib/roleHQ";

const ADMIN_ONLY = ["/app/command", "/app/admin", "/app/announcements", "/app/grind/admin"];
const LEADERSHIP_ONLY = ["/app/crm", "/app/recruitment", "/app/lead", "/app/review"];

const ROLES = [
  { key: "applicant", isAdmin: false },
  { key: "member", isAdmin: false },
  { key: "project_consultant", isAdmin: false },
  { key: "project_lead", isAdmin: false },
  { key: "board_member", isAdmin: false },
  { key: "admin", isAdmin: true },
  { key: "advisor", isAdmin: false },
] as const;

describe("role access matrix", () => {
  it("applicants never see internal club rooms", () => {
    const pb = selectPlaybook({ highestRole: "applicant", isAdmin: false });
    const urls = pb.resources.map((r) => r.url).concat(pb.navPriority);
    for (const u of [...ADMIN_ONLY, ...LEADERSHIP_ONLY, "/app/projects", "/app/messages"]) {
      expect(urls).not.toContain(u);
    }
  });

  it("members and consultants never see admin or leadership rooms", () => {
    for (const role of ["member", "project_consultant"]) {
      const pb = selectPlaybook({ highestRole: role, isAdmin: false });
      const urls = pb.resources.map((r) => r.url).concat(pb.navPriority);
      for (const u of ADMIN_ONLY) expect(urls).not.toContain(u);
      for (const u of ["/app/crm", "/app/recruitment"]) expect(urls).not.toContain(u);
    }
  });

  it("tech leads get review surfaces but no admin console", () => {
    const pb = selectPlaybook({ highestRole: "project_lead", isAdmin: false });
    const urls = pb.resources.map((r) => r.url);
    expect(urls).toContain("/app/lead");
    expect(urls).toContain("/app/review");
    for (const u of ADMIN_ONLY) expect(urls).not.toContain(u);
  });

  it("VP gets the pipeline, president gets the console", () => {
    const vp = selectPlaybook({ highestRole: "board_member", isAdmin: false });
    expect(vp.resources.map((r) => r.url)).toContain("/app/crm");
    expect(vp.title).toMatch(/VP/);

    const pres = selectPlaybook({ highestRole: "admin", isAdmin: true });
    expect(pres.resources.map((r) => r.url)).toContain("/app/command");
    expect(pres.title).toMatch(/President/);
  });

  it("alumni status overrides any stale role and grants only alumni rooms", () => {
    for (const role of ["member", "project_lead", "board_member"]) {
      const pb = selectPlaybook({ highestRole: role, isAdmin: false, memberStatus: "alumni" });
      expect(pb.key).toBe("alumni");
      const urls = pb.resources.map((r) => r.url);
      for (const u of [...ADMIN_ONLY, ...LEADERSHIP_ONLY]) expect(urls).not.toContain(u);
    }
  });

  it("no role, in any cohort, is ever routed to a parked module", () => {
    for (const r of ROLES) {
      const pb = selectPlaybook({ highestRole: r.key, isAdmin: r.isAdmin });
      for (const res of pb.resources) expect(parkedReason(res.url)).toBeNull();
      for (const u of pb.navPriority) expect(parkedReason(u)).toBeNull();
    }
  });

  it("every role's first destination is its own HQ", () => {
    for (const r of ROLES) {
      const pb = selectPlaybook({ highestRole: r.key, isAdmin: r.isAdmin });
      expect(pb.navPriority[0]).toBe("/app");
    }
  });

  it("every parked module states a reason (no silent dead ends)", () => {
    for (const p of SEASON_ONE_PARKED) {
      expect(p.reason.length).toBeGreaterThan(10);
      expect(parkedReason(p.url)).toBe(p.reason);
    }
  });

  it("every playbook duty list is actionable, not vague", () => {
    for (const pb of Object.values(PLAYBOOKS)) {
      for (const duty of pb.weekly) {
        // A duty a person can act on names a thing to do, not a feeling.
        expect(duty.length).toBeGreaterThan(15);
      }
    }
  });
});
