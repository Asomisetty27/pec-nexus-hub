import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const capabilities = [
  { id: "C1", title: "Mechanical Design", desc: "CAD modeling, FEA/CFD simulation, tolerance analysis, and DFM review, from napkin sketch to production-ready assembly.", tags: ["SolidWorks", "ANSYS", "GD&T"] },
  { id: "C2", title: "Product Development", desc: "Ideation, prototyping, testing, and manufacturing handoff across the product lifecycle.", tags: ["Rapid Prototyping", "3D Printing", "Testing"] },
  { id: "C3", title: "Data & Analytics", desc: "Data pipeline architecture, statistical analysis, interactive dashboards, and ML model development.", tags: ["Python", "SQL", "Tableau"] },
  { id: "C4", title: "Quality & Compliance", desc: "Process audits, failure mode analysis, testing protocols, and standards compliance.", tags: ["ISO 9001", "FMEA", "Six Sigma"] },
  { id: "C5", title: "Process Consulting", desc: "Lean manufacturing, workflow mapping, bottleneck identification, continuous improvement.", tags: ["Lean", "Kaizen", "Value Stream"] },
  { id: "C6", title: "Software Engineering", desc: "Full-stack web applications, automation, API integrations, and embedded firmware.", tags: ["React", "Node.js", "Embedded C"] },
  { id: "C7", title: "Systems Engineering", desc: "Requirements engineering, interface management, V&V planning, systems architecture.", tags: ["MBSE", "SysML", "Requirements"] },
  { id: "C8", title: "Electrical & Controls", desc: "PCB design, control system architecture, sensor integration, instrumentation.", tags: ["Altium", "MATLAB", "PLC"] },
];

const sprints = [
  { n: "S1", weeks: "Weeks 1–2", title: "Ground truth", body: "Discovery, constraints, success metrics. Ends with the Direction Gate: approach locked, rejected alternatives documented.", gate: "GATE 1 · INTERNAL" },
  { n: "S2", weeks: "Weeks 3–4", title: "First evidence", body: "Analysis, experiments, or first prototype pass. You see the artifact, not a promise.", gate: null },
  { n: "S3", weeks: "Weeks 5–6", title: "Midpoint", body: "What we learned, the risks, decisions we need from you, revised plan. Your reshape clause is live here.", gate: "GATE 2 · CLIENT-FACING" },
  { n: "S4", weeks: "Weeks 7–8", title: "Build depth", body: "The main body of work, against the plan you approved at midpoint.", gate: null },
  { n: "S5", weeks: "Weeks 9–10", title: "Brutal QA", body: "Mock presentation to people who have never seen the project. Units, assumptions, reproducibility, story.", gate: "GATE 3 · INTERNAL" },
  { n: "S6", weeks: "Weeks 11–12", title: "Delivery", body: "Report, presentation, handoff package, and the implementation plan your team can execute without us.", gate: null },
];

const terms = [
  ["1 hour/week", "All we ask of your liaison. Your time is scoped like our work is."],
  ["48-hour response", "Both directions, in writing. Silence is never the signal."],
  ["Weekly written status", "Every week, meeting or no meeting."],
  ["Midpoint reshape clause", "At the midpoint gate, either side may swap remaining scope for equal effort. Pre-agreed, no renegotiation drama."],
] as const;

const rise = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.45, ease: "easeOut" as const } }),
};

export default function Services() {
  return (
    <>
      {/* HERO */}
      <section className="reg-marks border-b border-foreground bg-grid">
        <div className="container pb-14 pt-20">
          <span className="label text-muted-foreground">process specification · rev b</span>
          <h1 className="mt-4 max-w-3xl font-display text-6xl leading-[0.95] tracking-tight md:text-7xl">
            How the work <span className="text-accent">actually runs.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            One engagement per semester, six two-week sprints, something you can see at the
            end of every one. This page is the same spec our team runs on internally;
            publishing it is the point.
          </p>
        </div>
      </section>

      {/* SPRINT SPEC */}
      <section className="border-b border-foreground">
        <div className="container py-16">
          <div className="mb-10 flex items-baseline gap-4">
            <span className="label text-accent">01</span>
            <h2 className="font-display text-4xl tracking-tight md:text-5xl">Six sprints, three gates</h2>
            <div className="hidden h-px flex-1 bg-border sm:block" />
          </div>
          <p className="mb-10 max-w-2xl text-muted-foreground">
            Most student teams show clients work twice: kickoff and final. We end every sprint
            with a client-visible artifact: a finding, a test result, a prototype increment,
            a decision memo. A slipped sprint is visible in two weeks, not at the end.
          </p>
          <div className="grid gap-px overflow-hidden border border-foreground bg-foreground sm:grid-cols-2 lg:grid-cols-3">
            {sprints.map((s, i) => (
              <motion.div key={s.n} className="bg-background p-6" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={rise} custom={i}>
                <div className="flex items-baseline justify-between">
                  <span className="label text-accent">{s.n}</span>
                  <span className="label text-muted-foreground">{s.weeks}</span>
                </div>
                <h3 className="mt-3 font-display text-2xl">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                {s.gate && <span className="stamp mt-4 text-secondary">{s.gate}</span>}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CLIENT TERMS */}
      <section className="border-b border-foreground bg-muted/60">
        <div className="container py-16">
          <div className="mb-10 flex items-baseline gap-4">
            <span className="label text-accent">02</span>
            <h2 className="font-display text-4xl tracking-tight md:text-5xl">Terms we publish</h2>
            <div className="hidden h-px flex-1 bg-border sm:block" />
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {terms.map(([t, d], i) => (
              <motion.div key={t} className="title-block bg-card p-6" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={rise} custom={i}>
                <div className="font-display text-3xl">{t}</div>
                <p className="mt-2 text-sm text-muted-foreground">{d}</p>
              </motion.div>
            ))}
          </div>
          <p className="label mt-4 text-muted-foreground">
            escalation is automatic: client silence over 7 days or scope growth over 15% reaches our president without anyone asking
          </p>
        </div>
      </section>

      {/* CAPABILITIES */}
      <section className="border-b border-foreground">
        <div className="container py-16">
          <div className="mb-10 flex items-baseline gap-4">
            <span className="label text-accent">03</span>
            <h2 className="font-display text-4xl tracking-tight md:text-5xl">What we take on</h2>
            <div className="hidden h-px flex-1 bg-border sm:block" />
          </div>
          <div className="grid gap-px overflow-hidden border border-foreground bg-foreground sm:grid-cols-2">
            {capabilities.map((c, i) => (
              <motion.div key={c.id} className="bg-background p-6 transition-colors hover:bg-card" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={rise} custom={i % 2}>
                <span className="label text-accent">{c.id}</span>
                <h3 className="mt-2 font-display text-2xl">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.desc}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {c.tags.map((t) => (
                    <span key={t} className="badge-verified">{t}</span>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-grid">
        <div className="container py-20 text-center">
          <h2 className="font-display text-4xl tracking-tight md:text-5xl">One slot this fall.</h2>
          <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
            We run a single engagement per semester so nothing about this spec is aspirational.
            The intake form maps one-to-one to how we score fit.
          </p>
          <div className="mt-8 flex justify-center">
            <Link to="/intake" className="label inline-flex items-center gap-3 bg-accent px-6 py-3.5 text-accent-foreground transition-colors hover:bg-primary hover:text-primary-foreground">
              Start a project <span aria-hidden>↗</span>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
