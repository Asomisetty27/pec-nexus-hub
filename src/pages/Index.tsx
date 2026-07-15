import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

/* The 12-week engagement rendered as a dimensioned technical drawing. */
function EngagementDrawing() {
  const W = 720;
  const H = 150;
  const x0 = 40;
  const x1 = W - 40;
  const span = x1 - x0;
  const wx = (week: number) => x0 + ((week - 1) / 11) * span;
  const gates = [
    { week: 3, name: "GATE 1 · DESIGN REVIEW", cls: "text-secondary" },
    { week: 6, name: "GATE 2 · CLIENT MIDPOINT", cls: "text-accent" },
    { week: 11, name: "GATE 3 · FINAL QA", cls: "text-secondary" },
  ];
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label="Twelve week engagement timeline with quality gates at weeks three, six, and eleven"
    >
      <line x1={x0} y1={90} x2={x1} y2={90} stroke="currentColor" strokeWidth="1.5" />
      {Array.from({ length: 12 }, (_, i) => (
        <g key={i}>
          <line x1={wx(i + 1)} y1={84} x2={wx(i + 1)} y2={96} stroke="currentColor" strokeWidth="1" />
          <text
            x={wx(i + 1)}
            y={112}
            textAnchor="middle"
            fontSize="9"
            className="font-mono"
            fill="currentColor"
            opacity="0.55"
          >
            W{i + 1}
          </text>
        </g>
      ))}
      <text x={x0} y={132} textAnchor="start" fontSize="9" className="font-mono" fill="currentColor" opacity="0.8">
        KICKOFF · SIGNED SCOPE
      </text>
      <text x={x1} y={132} textAnchor="end" fontSize="9" className="font-mono" fill="currentColor" opacity="0.8">
        DELIVERY · REPORT + PRESENTATION
      </text>
      {gates.map((g) => (
        <g key={g.week} className={g.cls}>
          <circle cx={wx(g.week)} cy={90} r={7} fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx={wx(g.week)} cy={90} r={2.5} fill="currentColor" />
          <line
            x1={wx(g.week)}
            y1={81}
            x2={wx(g.week)}
            y2={44}
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          <text x={wx(g.week)} y={36} textAnchor="middle" fontSize="9" className="font-mono" fill="currentColor" letterSpacing="1">
            {g.name}
          </text>
        </g>
      ))}
    </svg>
  );
}

const teams = [
  {
    id: "T1",
    name: "Hardware & Embedded Delivery",
    desc: "Circuit and PCB design, embedded firmware, sensor integration, systems bring-up, integration and debug.",
  },
  {
    id: "T2",
    name: "Software & AI Delivery",
    desc: "Full-stack applications, AI integration, data pipelines, automation, and software architecture.",
  },
  {
    id: "T3",
    name: "Mechanical & Manufacturing Delivery",
    desc: "CAD, prototyping, DFM reviews, fixture design, materials selection, and manufacturing plans.",
  },
  {
    id: "T4",
    name: "Business & Marketing",
    desc: "Company relations and client pipeline, brand and social presence, fundraisers, and market analysis.",
  },
];

const guarantees = [
  [
    "Signed scope",
    "A one-page scope document agreed by email before kickoff. Out-of-scope items are listed explicitly.",
  ],
  [
    "Weekly written status",
    "Even in weeks with no meeting, you get a written update. Silence is never the signal.",
  ],
  [
    "Escalation you can see",
    "Client silence over 7 days, scope growth over 15%, or two missed deadlines escalate automatically to our VP and President.",
  ],
  [
    "We decline honestly",
    "Projects that score poorly on feasibility or safety are declined or reshaped in writing, not accepted and fumbled.",
  ],
] as const;

interface Metric {
  id: string;
  label: string;
  value: string;
  subtitle: string | null;
  display_order: number;
}

const rise = {
  hidden: { opacity: 0, y: 18 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: "easeOut" as const },
  }),
};

export default function Index() {
  const [stats, setStats] = useState<Metric[]>([]);

  useEffect(() => {
    supabase
      .from("public_metrics")
      .select("id, label, value, subtitle, display_order")
      .eq("visible", true)
      .order("display_order")
      .then(({ data }) => setStats((data as Metric[]) || []));
  }, []);

  return (
    <>
      {/* HERO */}
      <section className="reg-marks border-b border-foreground bg-grid">
        <div className="container pb-16 pt-20 md:pt-28">
          <motion.div initial="hidden" animate="visible" variants={rise} custom={0}>
            <div className="flex flex-wrap items-center gap-3">
              <span className="stamp stamp-tilt text-accent">accepting fall 2026 clients</span>
              <span className="label text-muted-foreground">cal poly · san luis obispo</span>
            </div>
            <h1 className="mt-6 max-w-4xl font-display text-6xl leading-[0.95] tracking-tight sm:text-7xl lg:text-8xl">
              Student engineers.
              <br />
              <span className="text-accent">Firm-grade</span> delivery.
            </h1>
            <p className="mt-8 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Poly-Engineering Consulting takes on one scoped engineering problem per client,
              per semester: hardware, software, mechanical, or operations. Signed scope before
              kickoff, a written status update every week, and three quality gates before
              anything reaches your desk.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                to="/intake"
                className="label inline-flex items-center gap-3 bg-accent px-6 py-3.5 text-accent-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
              >
                Start a project <span aria-hidden>↗</span>
              </Link>
              <Link
                to="/apply"
                className="label inline-flex items-center gap-3 border border-foreground px-6 py-3.5 transition-colors hover:border-accent hover:text-accent"
              >
                Join the team <span aria-hidden>↗</span>
              </Link>
            </div>
          </motion.div>
        </div>

        {/* stat strip (admin-editable via public_metrics) */}
        {stats.length > 0 && (
          <div className="border-t border-foreground bg-card">
            <div className="container grid grid-cols-2 gap-px md:grid-cols-4">
              {stats.slice(0, 4).map((s, i) => (
                <motion.div
                  key={s.id}
                  className="border-border px-2 py-6 md:border-l md:first:border-l-0 md:px-6"
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={rise}
                  custom={i}
                >
                  <div className="font-display text-4xl">{s.value}</div>
                  <div className="label mt-1 text-muted-foreground">{s.label}</div>
                  {s.subtitle && <div className="mt-1 text-xs text-muted-foreground">{s.subtitle}</div>}
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ENGAGEMENT DRAWING */}
      <section className="border-b border-foreground">
        <div className="container py-20">
          <div className="mb-10 flex items-baseline gap-4">
            <span className="label text-accent">01</span>
            <h2 className="font-display text-4xl tracking-tight md:text-5xl">The engagement, drawn to spec</h2>
            <div className="hidden h-px flex-1 bg-border sm:block" />
          </div>
          <p className="mb-10 max-w-2xl text-muted-foreground">
            Every project runs the same 12-week drawing. You sign a one-page scope before we
            start, you see a midpoint review at week 6, and nothing ships without passing an
            internal QA review at week 11. Scope changes above 15% require written approval
            from our VP or President, so your budget of our time is protected in both directions.
          </p>
          <motion.div
            className="title-block reg-marks bg-card p-6 sm:p-10"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <EngagementDrawing />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
              <span className="label text-muted-foreground">FIG. 1 · STANDARD ENGAGEMENT · SCALE: ONE SEMESTER</span>
              <Link to="/services" className="label text-accent transition-colors hover:text-foreground">
                full process spec →
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CAPABILITIES */}
      <section className="border-b border-foreground bg-muted/60">
        <div className="container py-20">
          <div className="mb-10 flex items-baseline gap-4">
            <span className="label text-accent">02</span>
            <h2 className="font-display text-4xl tracking-tight md:text-5xl">Four teams, one intake</h2>
            <div className="hidden h-px flex-1 bg-border sm:block" />
          </div>
          <div className="grid gap-px overflow-hidden border border-foreground bg-foreground sm:grid-cols-2">
            {teams.map((t, i) => (
              <motion.div
                key={t.id}
                className="group bg-background p-6 transition-colors hover:bg-card sm:p-8"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={rise}
                custom={i}
              >
                <span className="label text-accent">{t.id}</span>
                <h3 className="mt-3 font-display text-2xl">{t.name}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t.desc}</p>
              </motion.div>
            ))}
          </div>
          <p className="label mt-4 text-muted-foreground">
            Cross-team problems are staffed across teams under a single project manager.
          </p>
        </div>
      </section>

      {/* THE HONEST PITCH */}
      <section className="border-b border-foreground">
        <div className="container py-20">
          <div className="mb-10 flex items-baseline gap-4">
            <span className="label text-accent">03</span>
            <h2 className="font-display text-4xl tracking-tight md:text-5xl">The honest pitch</h2>
            <div className="hidden h-px flex-1 bg-border sm:block" />
          </div>
          <div className="grid gap-10 md:grid-cols-2">
            <div className="space-y-4 text-lg leading-relaxed">
              <p>
                We are undergraduates. You should not hire us on polish alone, and we will not
                pretend to be a staffed firm. What we offer instead is a published operating
                system: every rule we run on, from acceptance scoring to escalation triggers,
                is public on this site.
              </p>
              <p>
                If your problem fits a semester and our rubric, you get a motivated team with
                faculty-adjacent resources, managed by a process designed so that nothing
                surprises you at the end.
              </p>
            </div>
            <ul className="space-y-4">
              {guarantees.map(([t, d], i) => (
                <motion.li
                  key={t}
                  className="border-l-2 border-accent pl-4"
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={rise}
                  custom={i}
                >
                  <div className="label">{t}</div>
                  <p className="mt-1 text-sm text-muted-foreground">{d}</p>
                </motion.li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* SEMESTER CALENDAR */}
      <section className="border-b border-foreground bg-muted/60">
        <div className="container py-20">
          <div className="mb-10 flex items-baseline gap-4">
            <span className="label text-accent">04</span>
            <h2 className="font-display text-4xl tracking-tight md:text-5xl">Built for the semester calendar</h2>
            <div className="hidden h-px flex-1 bg-border sm:block" />
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {[
              {
                cycle: "Fall 2026",
                window: "Kickoff by mid-September · delivery by December 4",
                note: "Signed by June. Nothing crosses winter break.",
                open: true,
              },
              {
                cycle: "Spring 2027",
                window: "Kickoff by mid-February · delivery by May 7",
                note: "Signed by November. Delivered before finals.",
                open: false,
              },
            ].map((c) => (
              <div key={c.cycle} className="title-block bg-card p-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-2xl">{c.cycle}</h3>
                  <span className={`stamp ${c.open ? "text-accent" : "text-muted-foreground"}`}>
                    {c.open ? "open" : "pipeline"}
                  </span>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{c.window}</p>
                <p className="label mt-3 text-muted-foreground">{c.note}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 max-w-2xl text-sm text-muted-foreground">
            Cal Poly moves to semesters in fall 2026. One engagement per semester, two per
            year, with client pipelines signed a term ahead. If you want a spring slot, the
            conversation starts now.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-grid">
        <div className="container py-24 text-center">
          <h2 className="font-display text-5xl tracking-tight md:text-6xl">
            Have a problem that fits a semester?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            The intake form takes five minutes and maps one-to-one to how we score and accept
            projects. You hear back within 48 hours either way.
          </p>
          <div className="mt-10 flex justify-center">
            <Link
              to="/intake"
              className="label inline-flex items-center gap-3 bg-accent px-6 py-3.5 text-accent-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              Start a project <span aria-hidden>↗</span>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
