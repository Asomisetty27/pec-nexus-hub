import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Cog, Users, BarChart3, Lightbulb, Shield, Rocket, Wrench, Cpu } from "lucide-react";
import { motion } from "framer-motion";

const services = [
  { icon: Cog, title: "Mechanical Design", desc: "CAD modeling, FEA/CFD simulation, tolerance analysis, and DFM review. We take concepts from napkin sketches to production-ready assemblies.", tags: ["SolidWorks", "ANSYS", "GD&T"] },
  { icon: Lightbulb, title: "Product Development", desc: "End-to-end product lifecycle: ideation, prototyping, testing, and manufacturing handoff.", tags: ["Rapid Prototyping", "3D Printing", "Testing"] },
  { icon: BarChart3, title: "Data & Analytics", desc: "Data pipeline architecture, statistical analysis, interactive dashboards, and ML model development.", tags: ["Python", "SQL", "Tableau"] },
  { icon: Shield, title: "Quality & Compliance", desc: "Process audits, failure mode analysis (FMEA), testing protocols, and standards compliance.", tags: ["ISO 9001", "FMEA", "Six Sigma"] },
  { icon: Users, title: "Process Consulting", desc: "Lean manufacturing, workflow mapping, bottleneck identification, and continuous improvement.", tags: ["Lean", "Kaizen", "Value Stream"] },
  { icon: Rocket, title: "Software Engineering", desc: "Full-stack web applications, automation scripts, API integrations, and embedded systems firmware.", tags: ["React", "Node.js", "Embedded C"] },
  { icon: Wrench, title: "Systems Engineering", desc: "Requirements engineering, interface management, V&V planning, and systems architecture.", tags: ["MBSE", "SysML", "Requirements"] },
  { icon: Cpu, title: "Electrical & Controls", desc: "PCB design, control system architecture, sensor integration, and instrumentation.", tags: ["Altium", "MATLAB", "PLC"] },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.45, ease: "easeOut" as const },
  }),
};

export default function Services() {
  return (
    <div className="py-20">
      <div className="container">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-2xl text-center">
          <h1 className="font-display text-4xl font-bold md:text-5xl">Our Services</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Professional engineering consulting powered by Cal Poly's best student talent.
          </p>
        </motion.div>

        <div className="mt-16 grid gap-6 md:grid-cols-2">
          {services.map((svc, i) => (
            <motion.div key={svc.title} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
              <Card className="h-full transition-all hover:shadow-md">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-accent/15">
                      <svc.icon className="h-6 w-6 text-accent" />
                    </div>
                    <div>
                      <h3 className="font-sans text-lg font-semibold">{svc.title}</h3>
                      <p className="mt-2 text-sm text-muted-foreground">{svc.desc}</p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {svc.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
