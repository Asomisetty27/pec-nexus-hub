import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Star, Award, Trophy } from "lucide-react";

const tiers = [
  {
    name: "Platinum",
    icon: Trophy,
    color: "text-accent",
    sponsors: ["Raytheon Technologies", "Lockheed Martin", "Boeing"],
  },
  {
    name: "Gold",
    icon: Star,
    color: "text-accent",
    sponsors: ["Tesla", "SpaceX", "Amazon Robotics", "Apple"],
  },
  {
    name: "Silver",
    icon: Award,
    color: "text-muted-foreground",
    sponsors: ["Northrop Grumman", "General Dynamics", "Collins Aerospace", "Honeywell", "BAE Systems"],
  },
];

export default function Sponsors() {
  return (
    <div className="py-20">
      <div className="container">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-2xl text-center">
          <h1 className="font-display text-4xl font-bold md:text-5xl">Our Sponsors</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            The organizations that make PEC possible. Become a partner today.
          </p>
        </motion.div>

        <div className="mt-16 space-y-12">
          {tiers.map((tier, ti) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: ti * 0.15 }}
            >
              <div className="mb-4 flex items-center gap-2">
                <tier.icon className={`h-5 w-5 ${tier.color}`} />
                <h2 className="font-sans text-xl font-semibold">{tier.name} Partners</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {tier.sponsors.map((name) => (
                  <Card key={name} className="transition-all hover:shadow-md">
                    <CardContent className="flex items-center gap-4 p-5">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted font-display text-lg font-bold text-muted-foreground">
                        {name[0]}
                      </div>
                      <div>
                        <div className="font-semibold">{name}</div>
                        <Badge variant="outline" className="mt-1 text-xs">{tier.name}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-16 rounded-xl bg-primary p-10 text-center text-primary-foreground"
        >
          <h2 className="font-display text-2xl font-bold">Become a Sponsor</h2>
          <p className="mt-3 opacity-80">
            Partner with Cal Poly's top engineering talent. Gain access to project work, recruiting events, and brand visibility.
          </p>
          <Link to="/intake">
            <Button size="lg" className="mt-6 bg-accent text-accent-foreground hover:bg-accent/90">
              Get in Touch
            </Button>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
