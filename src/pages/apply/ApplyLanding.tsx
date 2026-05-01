import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Calendar, CheckCircle2, Clock, FileText, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

type ActiveCycle = {
  id: string;
  season: "fall" | "spring";
  year: number;
  opens_at: string;
  closes_at: string;
};

const PROCESS = [
  { icon: FileText, title: "Apply", body: "Submit a short written application and resume." },
  { icon: Users, title: "Review", body: "Cohort leadership reviews fit and routes you to the right discipline." },
  { icon: CheckCircle2, title: "Interview", body: "Selected applicants meet with cohort leads for a short conversation." },
  { icon: Clock, title: "Decision", body: "You hear back within the cycle window. No surprise silences." },
];

export default function ApplyLanding() {
  const [loading, setLoading] = useState(true);
  const [cycle, setCycle] = useState<ActiveCycle | null>(null);

  useEffect(() => {
    document.title = "Apply to PEC | Poly-Engineering Consulting";
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc("get_active_application_cycle");
      if (!cancelled) {
        const row = Array.isArray(data) ? data[0] : null;
        setCycle(row ?? null);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const open = !!cycle;

  return (
    <div className="py-16 md:py-20">
      <div className="container max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto max-w-3xl text-center"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
            <Users className="h-3 w-3" /> Membership application
          </div>
          <h1 className="mt-4 font-display text-4xl font-bold tracking-tight md:text-5xl">
            Build real engineering. With a serious team.
          </h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground md:text-lg">
            Poly-Engineering Consulting is a student-run engineering organization at Cal Poly SLO.
            We deliver hardware, software, mechanical, and operations work on real contracts,
            competitions, and internal R&D missions. Membership is selective and structured.
          </p>

          <div className="mt-6 flex items-center justify-center">
            {loading ? (
              <Badge variant="outline" className="text-xs">Checking application status…</Badge>
            ) : open ? (
              <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                Applications open · {cycle!.season === "fall" ? "Fall" : "Spring"} {cycle!.year}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs">
                Applications are currently closed
              </Badge>
            )}
          </div>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {open ? (
              <Button asChild size="lg" className="gap-2">
                <Link to="/apply/form">
                  Start application <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <Button size="lg" disabled>
                Applications closed
              </Button>
            )}
            <Button asChild size="lg" variant="outline">
              <Link to="/services">Learn what we do</Link>
            </Button>
          </div>

          {open && (
            <p className="mt-3 text-xs text-muted-foreground">
              Cycle closes {new Date(cycle!.closes_at).toLocaleDateString(undefined, {
                month: "long", day: "numeric", year: "numeric",
              })}.
            </p>
          )}
        </motion.div>

        <section className="mt-16">
          <h2 className="text-center font-display text-2xl font-bold">How recruiting works</h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-muted-foreground">
            We recruit primarily in the Fall, and occasionally in Spring. Each cycle has a defined window —
            we don't run rolling intake.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PROCESS.map((p) => (
              <Card key={p.title} className="border-border/60">
                <CardContent className="pt-6">
                  <p.icon className="h-5 w-5 text-primary" />
                  <h3 className="mt-3 font-semibold">{p.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{p.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <Card className="border-border/60 bg-muted/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Calendar className="mt-0.5 h-5 w-5 text-primary" />
                <div>
                  <h3 className="font-semibold">When we recruit</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Fall is our primary intake. We occasionally open a smaller Spring cycle when cohort capacity allows.
                    If applications are closed today, the next cycle will be announced on this page and through
                    Cal Poly engineering channels.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}