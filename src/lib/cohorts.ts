// Canonical cohort identity (operating model v2, 2026-07-15).
// Cohorts are identified by function_key — names are display text and can
// change. Every access check or routing decision must use isBusinessCohort /
// function keys, never string-match a display name (that broke CRM access
// once). LEGACY_* names are accepted as fallback for pre-migration rows.

export const COHORT_FUNCTION_KEYS = {
  business: "business_marketing",
  software: "software_ai",
  hardware: "hardware_embedded",
  mechanical: "mech_manufacturing",
} as const;

export const COHORT_NAMES = [
  "Business & Marketing",
  "Software & AI Delivery",
  "Hardware & Embedded Delivery",
  "Mechanical & Manufacturing Delivery",
] as const;

const LEGACY_BUSINESS_NAMES = ["Ops / PM"];

/** The cohort that runs Company Relations + Brand (owns the CRM surface). */
export function isBusinessCohort(cohort: { function_key?: string | null; name?: string | null } | null | undefined): boolean {
  if (!cohort) return false;
  if (cohort.function_key) return cohort.function_key === COHORT_FUNCTION_KEYS.business;
  return LEGACY_BUSINESS_NAMES.includes(cohort.name ?? "");
}
