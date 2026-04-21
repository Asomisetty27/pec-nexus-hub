import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Cog, Users, BarChart3, Lightbulb, Shield, Rocket } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

const services = [
  { icon: Cog, title: "Mechanical Design", desc: "CAD modeling, FEA analysis, and prototype development." },
  { icon: Lightbulb, title: "Product Development", desc: "From concept to production-ready deliverables." },
  { icon: BarChart3, title: "Data & Analytics", desc: "Data pipelines, dashboards, and insight generation." },
  { icon: Shield, title: "Quality Assurance", desc: "Testing frameworks, process audits, and compliance." },
  { icon: Users, title: "Process Consulting", desc: "Lean manufacturing, workflow optimization." },
  { icon: Rocket, title: "Software Solutions", desc: "Web apps, automation tools, and integrations." },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" as const },
  }),
};

interface Metric { id: string; label: string; value: string; subtitle: string | null; display_order: number; }

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
      {/* Hero */}
      <section className="relative overflow-hidden py-24 md:py-32">
        <div className="container relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="mx-auto max-w-3xl text-center"
          >
            <span className="inline-block rounded-full bg-accent/20 px-4 py-1.5 text-sm font-semibold text-accent-foreground">
              Cal Poly SLO's Premier Engineering Consultancy
            </span>
            <h1 className="mt-6 font-display text-5xl font-bold leading-tight tracking-tight md:text-6xl lg:text-7xl">
              Engineering Solutions,{" "}
              <span className="text-accent">Student Driven</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground md:text-xl">
              Poly-Engineering Consulting connects Cal Poly's top engineering talent with 
              real-world industry challenges. Professional results, student excellence.
            </p>
            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link to="/intake">
                <Button size="lg" className="gap-2 text-base">
                  Work With Us <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/services">
                <Button variant="outline" size="lg" className="text-base">
                  View Services
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
        {/* Background decoration */}
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-secondary/10 blur-3xl" />
      </section>

      {/* Stats */}
      {stats.length > 0 && (
      <section className="border-y bg-card py-12">
        <div className="container">
          <div className={`grid gap-8 ${stats.length >= 4 ? "grid-cols-2 md:grid-cols-4" : stats.length === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"}`}>
            {stats.map((stat, i) => (
              <motion.div
                key={stat.id}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                className="text-center"
              >
                <div className="font-display text-4xl font-bold text-accent">{stat.value}</div>
                <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
                {stat.subtitle && <div className="mt-1 text-xs text-muted-foreground/70">{stat.subtitle}</div>}
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* Services */}
      <section className="py-20 md:py-28">
        <div className="container">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mx-auto max-w-2xl text-center"
          >
            <h2 className="font-display text-3xl font-bold md:text-4xl">Our Services</h2>
            <p className="mt-4 text-muted-foreground">
              From mechanical design to software solutions, PEC delivers professional-grade consulting across engineering disciplines.
            </p>
          </motion.div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((svc, i) => (
              <motion.div
                key={svc.title}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
              >
                <Card className="group h-full transition-all duration-200 hover:shadow-md hover:-translate-y-1">
                  <CardContent className="p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent/15">
                      <svc.icon className="h-6 w-6 text-accent" />
                    </div>
                    <h3 className="mt-4 font-sans text-lg font-semibold">{svc.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{svc.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary py-20">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mx-auto max-w-2xl text-center"
          >
            <h2 className="font-display text-3xl font-bold text-primary-foreground md:text-4xl">
              Ready to Start Your Project?
            </h2>
            <p className="mt-4 text-primary-foreground/80">
              Submit a project inquiry and our team will get back to you within 48 hours.
            </p>
            <Link to="/intake">
              <Button size="lg" variant="secondary" className="mt-8 gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
                Submit Project Inquiry <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>
    </>
  );
}
