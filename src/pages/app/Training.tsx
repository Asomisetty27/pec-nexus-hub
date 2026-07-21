import { Link } from "react-router-dom";
import { GraduationCap, ArrowRight } from "lucide-react";
import Grind from "./Grind";

/**
 * Training = the drill practice engine (Grind). Structured cohort onboarding
 * (the Orient -> Learn -> Shadow -> First Unit -> Certified track, lab manuals,
 * and mock projects) lives in Cohort Hub. The old Academy/courses tab was
 * retired: that table never had any content (0 records) and read as an empty
 * "no trainings" surface. Drills are the live learning surface; the cohort track
 * is one click away.
 */
export default function Training() {
  return (
    <div className="container mx-auto max-w-7xl space-y-4 p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-bold tracking-tight">Training</h1>
          <p className="text-sm text-muted-foreground">
            Sharpen your craft with drills. Your cohort's onboarding track, lab manuals, and mock projects live in Cohort Hub.
          </p>
        </div>
        <Link
          to="/app/cohort"
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
        >
          <GraduationCap className="h-4 w-4" /> Cohort Hub <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </header>

      {/* Grind supplies its own container/padding; offset to full width. */}
      <div className="-mx-6">
        <Grind />
      </div>
    </div>
  );
}
