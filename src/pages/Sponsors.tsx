import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Handshake, Users, Wrench, Trophy, ArrowRight } from "lucide-react";

const partnershipTracks = [
  {
    icon: Wrench,
    title: "Contract engineering",
    body: "Bring a real engineering need. A scoped student team delivers it under structured oversight.",
  },
  {
    icon: Trophy,
    title: "Competition sponsorship",
    body: "Back PEC competition entries: funding, hardware, mentorship: and get visibility with top Cal Poly talent.",
  },
  {
    icon: Users,
    title: "Recruiting access",
    body: "Connect with vetted, project-experienced engineers across hardware, software, mechanical, and ops.",
  },
];

export default function Sponsors() {
  return (
    <div className="py-20">
      <div className="container max-w-5xl">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
            <Handshake className="h-3.5 w-3.5" /> Open to founding partners
          </div>
          <h1 className="mt-4 font-display text-4xl font-bold md:text-5xl">Partner with PEC</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            We're a new student-led engineering consultancy at Cal Poly. We don't currently have public sponsors: and we'd rather be honest than fake a logo wall. If your organization wants to be part of building the first cohort of partners, this is the moment.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-12 rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center"
        >
          <p className="text-sm uppercase tracking-wider text-muted-foreground">Current sponsor roster</p>
          <p className="mt-2 font-display text-2xl">No public sponsors yet: by design.</p>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
            Once a partner has signed on and approved being listed, they'll appear here. We'd rather show zero real partners than a stock list.
          </p>
        </motion.div>

        <div className="mt-16 grid gap-4 md:grid-cols-3">
          {partnershipTracks.map((t, i) => (
            <motion.div
              key={t.title}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
            >
              <Card className="h-full">
                <CardContent className="flex h-full flex-col gap-3 p-6">
                  <t.icon className="h-5 w-5 text-accent" />
                  <h3 className="font-display text-lg font-semibold">{t.title}</h3>
                  <p className="text-sm text-muted-foreground">{t.body}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-16 rounded-xl bg-primary p-10 text-center text-primary-foreground"
        >
          <h2 className="font-display text-2xl font-bold">Be one of our first partners</h2>
          <p className="mx-auto mt-3 max-w-xl opacity-80">
            Tell us what you're working on. We'll respond personally, scope a fit, and: if it makes sense: bring your project into a cohort.
          </p>
          <Link to="/intake">
            <Button size="lg" className="mt-6 gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
              Start a conversation <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
