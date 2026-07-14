import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

interface ArchiveProject {
  id: string;
  name: string | null;
  description: string | null;
}

/**
 * The club record, drawn as an engineering revision block: every era logged
 * honestly, including the founding year that shipped structure but no client
 * work. Archived projects render from the database as they accumulate;
 * the claim discipline is that this page shows nothing the archive
 * cannot back.
 */
export default function History() {
  const [archived, setArchived] = useState<ArchiveProject[]>([]);

  useEffect(() => {
    supabase
      .from("projects")
      .select("id, name, description")
      .eq("status", "archived")
      .then(({ data, error }) => {
        if (!error && data) setArchived(data as ArchiveProject[]);
      });
  }, []);

  const eras = [
    {
      rev: "REV A",
      period: "2024 – 2026",
      title: "Founding era",
      status: "archived",
      body: "PEC formed at Cal Poly and built its operating system: the intake rubric, quality gates, decision-rights matrix, and this platform. No client engagements were delivered in the founding era, and we would rather say that plainly than pad this page. The lesson it taught is the reason the current model exists: structure follows work, not the other way around.",
    },
    {
      rev: "REV B",
      period: "Fall 2026",
      title: "First delivery era",
      status: "current",
      body: "The club re-forms under the semester calendar around one signed client engagement and one hand-picked team of 6 to 8 engineers. Five two-week sprints, a client-visible artifact every sprint, delivery the first week of December. Every project that completes lands on this page with its outcome and the client's own words.",
    },
  ];

  return (
    <>
      <section className="reg-marks border-b border-foreground bg-grid">
        <div className="container pb-14 pt-20">
          <span className="label text-muted-foreground">drawing register · club record</span>
          <h1 className="mt-4 max-w-3xl font-display text-6xl leading-[0.95] tracking-tight md:text-7xl">
            The record, <span className="text-accent">unpadded.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            Every era of the club, logged like a revision block: what happened, what shipped,
            and what we changed. Nothing appears here that the archive cannot back.
          </p>
        </div>
      </section>

      <section className="border-b border-foreground">
        <div className="container py-16">
          <div className="space-y-6">
            {eras.map((era, i) => (
              <motion.article
                key={era.rev}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: i * 0.08 }}
                className={`title-block bg-card p-6 sm:p-8 ${era.status === "current" ? "live-edge" : ""}`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div className="flex items-baseline gap-4">
                    <span className="label text-accent">{era.rev}</span>
                    <h2 className="font-display text-3xl">{era.title}</h2>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="label text-muted-foreground">{era.period}</span>
                    <span className={`stamp ${era.status === "current" ? "text-accent" : "text-muted-foreground"}`}>
                      {era.status}
                    </span>
                  </div>
                </div>
                <p className="mt-4 max-w-3xl leading-relaxed text-muted-foreground">{era.body}</p>

                {era.status === "current" && (
                  <div className="mt-6 border-t border-border pt-4">
                    {archived.length > 0 ? (
                      <ul className="grid gap-3 sm:grid-cols-2">
                        {archived.map((p) => (
                          <li key={p.id} className="border border-border bg-background p-4">
                            <div className="font-display text-xl">{p.name}</div>
                            {p.description && (
                              <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="label text-muted-foreground">
                        first completed engagement lands here · december 2026
                      </p>
                    )}
                  </div>
                )}
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-grid">
        <div className="container py-20 text-center">
          <h2 className="font-display text-4xl tracking-tight md:text-5xl">
            Want your project on this page?
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
            One client slot per semester. Delivery in writing, every two weeks, or you will
            read about why here.
          </p>
          <div className="mt-8 flex justify-center">
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
