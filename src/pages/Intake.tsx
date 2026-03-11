import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Send } from "lucide-react";

export default function Intake() {
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    // TODO: wire to Supabase
    setTimeout(() => {
      setSubmitting(false);
      toast.success("Inquiry submitted! We'll be in touch within 48 hours.");
      (e.target as HTMLFormElement).reset();
    }, 1000);
  };

  return (
    <div className="py-20">
      <div className="container max-w-2xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="font-display text-3xl">Work With PEC</CardTitle>
              <CardDescription className="text-base">
                Tell us about your project and we'll match you with the right team.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" placeholder="Jane Smith" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" placeholder="jane@company.com" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company">Company / Organization</Label>
                  <Input id="company" placeholder="Acme Corp" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Inquiry Type</Label>
                  <Select required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="project">Project Inquiry</SelectItem>
                      <SelectItem value="sponsor">Sponsorship</SelectItem>
                      <SelectItem value="partner">Partnership</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Project Description</Label>
                  <Textarea id="description" rows={5} placeholder="Describe your project, timeline, and any specific requirements..." required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="budget">Estimated Budget Range</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select range..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="<5k">Under $5,000</SelectItem>
                      <SelectItem value="5k-15k">$5,000 – $15,000</SelectItem>
                      <SelectItem value="15k-50k">$15,000 – $50,000</SelectItem>
                      <SelectItem value="50k+">$50,000+</SelectItem>
                      <SelectItem value="tbd">To Be Determined</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" size="lg" className="w-full gap-2" disabled={submitting}>
                  <Send className="h-4 w-4" /> {submitting ? "Submitting..." : "Submit Inquiry"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
