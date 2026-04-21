import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Send, CheckCircle2, Mail, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function Intake() {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [engagementType, setEngagementType] = useState("");
  const [budget, setBudget] = useState("");
  const [timeline, setTimeline] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = (form.get("name") as string).trim();
    const email = (form.get("email") as string).trim().toLowerCase();
    const company = (form.get("company") as string).trim();
    const role = (form.get("role") as string).trim();
    const website = (form.get("website") as string).trim();
    const description = (form.get("description") as string).trim();

    if (!name || !email || !company || !engagementType || !description) {
      toast.error("Please fill in all required fields.");
      return;
    }
    if (description.length < 20) {
      toast.error("Please add a bit more detail about your project (20+ chars).");
      return;
    }

    setSubmitting(true);
    try {
      // Create or find organization (case-insensitive name match)
      let orgId: string | null = null;
      const { data: existingOrg } = await supabase
        .from("organizations")
        .select("id")
        .ilike("name", company)
        .limit(1)
        .maybeSingle();

      if (existingOrg) {
        orgId = existingOrg.id;
      } else {
        const { data: newOrg } = await supabase
          .from("organizations")
          .insert({ name: company, type: "client", website: website || null })
          .select("id")
          .single();
        if (newOrg) orgId = newOrg.id;
      }

      // Dedupe: if a lead with this email + org already exists in an open stage, update notes instead
      const { data: existingLead } = await supabase
        .from("leads")
        .select("id, notes")
        .ilike("contact_email", email)
        .eq("org_id", orgId!)
        .in("stage", ["new", "contacted", "scoping"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const noteBlock = `[${new Date().toISOString().slice(0, 10)}] ${description}`;

      if (existingLead) {
        await supabase
          .from("leads")
          .update({
            notes: `${existingLead.notes || ""}\n\n--- Follow-up ---\n${noteBlock}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingLead.id);
      } else {
      const { error: leadError } = await supabase.from("leads").insert({
        contact_name: name,
        contact_email: email,
        org_id: orgId,
        source: "intake_form",
        stage: "new" as any,
        contact_role: role || null,
        website: website || null,
        engagement_type: engagementType,
        timeline: timeline || null,
        budget_range: budget || null,
        notes: noteBlock,
      });
      if (leadError) throw leadError;
      }

      setSubmitted(true);
      toast.success("Inquiry received. PEC leadership has been notified.");
    } catch (err: any) {
      toast.error(err?.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="py-20">
        <div className="container max-w-2xl">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <Card>
              <CardContent className="flex flex-col items-center py-12 text-center">
                <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mb-4">
                  <CheckCircle2 className="h-8 w-8 text-success" />
                </div>
                <h2 className="font-display text-2xl font-bold mb-2">Inquiry Received</h2>
                <p className="text-muted-foreground max-w-md">
                  Thank you. Your inquiry has been logged in PEC's intake pipeline and is visible to club leadership.
                </p>
                <div className="mt-6 grid w-full max-w-md gap-3 text-left">
                  <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-3">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-accent-foreground" />
                    <div className="text-sm">
                      <p className="font-medium">What happens next</p>
                      <p className="text-xs text-muted-foreground mt-0.5">A PEC officer will review your submission within ~5 business days. If it aligns with active cohort capacity, we'll reach out to schedule a scoping call.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-3">
                    <Mail className="mt-0.5 h-4 w-4 shrink-0 text-accent-foreground" />
                    <div className="text-sm">
                      <p className="font-medium">Need to follow up?</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Email <a href="mailto:pec@calpoly.edu" className="underline">pec@calpoly.edu</a> referencing your company name.</p>
                    </div>
                  </div>
                </div>
                <Button variant="outline" className="mt-6" onClick={() => setSubmitted(false)}>
                  Submit Another Inquiry
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-20">
      <div className="container max-w-2xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="font-display text-3xl">Work With PEC</CardTitle>
              <CardDescription className="text-base">
                Poly-Engineering Consulting partners with companies, sponsors, and competition organizers. Tell us about your need and we'll route it to the right cohort.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Your Name *</Label>
                    <Input id="name" name="name" placeholder="Jane Smith" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Work Email *</Label>
                    <Input id="email" name="email" type="email" placeholder="jane@company.com" required />
                  </div>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="company">Company / Organization *</Label>
                    <Input id="company" name="company" placeholder="Acme Corp" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Your Role</Label>
                    <Input id="role" name="role" placeholder="VP Engineering" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Company Website</Label>
                  <Input id="website" name="website" type="url" placeholder="https://acme.com" />
                </div>
                <div className="space-y-2">
                  <Label>Engagement Type *</Label>
                  <Select value={engagementType} onValueChange={setEngagementType} required>
                    <SelectTrigger>
                      <SelectValue placeholder="What kind of engagement?" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contract">Contract — paid project work</SelectItem>
                      <SelectItem value="sponsorship">Sponsorship — fund a cohort or initiative</SelectItem>
                      <SelectItem value="competition">Competition collaboration</SelectItem>
                      <SelectItem value="exploratory">Exploratory conversation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">What do you need? *</Label>
                  <Textarea id="description" name="description" rows={5} placeholder="Describe the problem, the domain (e.g. embedded firmware, mechanical design, data tooling), and any specific requirements..." required minLength={20} />
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Timeline</Label>
                    <Select value={timeline} onValueChange={setTimeline}>
                      <SelectTrigger><SelectValue placeholder="When do you need this?" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="urgent">Urgent — within 4 weeks</SelectItem>
                        <SelectItem value="quarter">This quarter</SelectItem>
                        <SelectItem value="semester">This academic term</SelectItem>
                        <SelectItem value="flexible">Flexible</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Estimated Budget</Label>
                    <Select value={budget} onValueChange={setBudget}>
                      <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="<5k">Under $5,000</SelectItem>
                        <SelectItem value="5k-15k">$5,000 – $15,000</SelectItem>
                        <SelectItem value="15k-50k">$15,000 – $50,000</SelectItem>
                        <SelectItem value="50k+">$50,000+</SelectItem>
                        <SelectItem value="tbd">To Be Determined</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  By submitting, you agree your inquiry will be reviewed by Poly-Engineering Consulting officers at Cal Poly SLO. We do not share your information externally.
                </p>
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
