import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Send, CheckCircle2, Mail, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function Intake() {
  const [searchParams] = useSearchParams();
  // QR Studio tags every printed surface with ?src=; keep it on the lead so
  // the pipeline knows which flyer or handout did the work.
  const srcTag = (searchParams.get("src") ?? "").replace(/[^a-z0-9-]/gi, "-").slice(0, 40);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [engagementType, setEngagementType] = useState("");
  const [deliverablePreference, setDeliverablePreference] = useState("");
  const [budget, setBudget] = useState("");
  const [timeline, setTimeline] = useState("");
  const [ndaNeeded, setNdaNeeded] = useState(false);
  const [ipConcerns, setIpConcerns] = useState(false);
  const [proprietaryData, setProprietaryData] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = (form.get("name") as string).trim();
    const email = (form.get("email") as string).trim().toLowerCase();
    const phone = (form.get("phone") as string).trim();
    const company = (form.get("company") as string).trim();
    const role = (form.get("role") as string).trim();
    const website = (form.get("website") as string).trim();
    const problemSummary = (form.get("problem_summary") as string).trim();
    const desiredOutcome = (form.get("desired_outcome") as string).trim();
    const dataAvailable = (form.get("data_available") as string).trim();
    const constraints = (form.get("constraints") as string).trim();
    const decisionApprover = (form.get("decision_approver") as string).trim();

    if (!name || !email || !company || !engagementType || !problemSummary || !desiredOutcome || !deliverablePreference || !decisionApprover) {
      toast.error("Please fill in all required fields.");
      return;
    }
    if (problemSummary.length < 20) {
      toast.error("Problem summary needs a bit more detail (20+ characters).");
      return;
    }

    setSubmitting(true);
    try {
      // Anonymous visitors can INSERT (narrow RLS policies) but never SELECT
      // CRM tables, so: generate the org id client-side, insert with no
      // returning, and link the lead to it. Board dedupes in the CRM.
      let orgId: string | null = crypto.randomUUID();
      const { error: orgError } = await supabase
        .from("organizations")
        .insert({ id: orgId, name: company, type: "client", website: website || null });
      if (orgError) {
        // The inquiry must never be lost over an org hiccup; submit unlinked.
        orgId = null;
      }

      // Build structured notes block that captures all vault-required intake fields
      const sensitivityParts: string[] = [];
      if (ndaNeeded) sensitivityParts.push("NDA needed");
      if (ipConcerns) sensitivityParts.push("IP concerns");
      if (proprietaryData) sensitivityParts.push("Proprietary data");
      const sensitivityLine = sensitivityParts.length > 0 ? sensitivityParts.join(", ") : "None flagged";

      const noteBlock = `[${new Date().toISOString().slice(0, 10)}] ${problemSummary}

--- Full Intake Details ---
Desired outcome: ${desiredOutcome}
Deliverable preference: ${deliverablePreference}
Data / resources available: ${dataAvailable || "Not specified"}
Constraints (manufacturing / compliance / safety): ${constraints || "None specified"}
Budget range: ${budget || "Not specified"}
Sensitivity: ${sensitivityLine}
Decision approver: ${decisionApprover}`;

      const urgencyValue = timeline === "urgent" ? "high" : timeline === "quarter" ? "medium" : "low";
      const { error: leadError } = await supabase.from("leads").insert({
        contact_name: name,
        contact_email: email,
        contact_phone: phone || null,
        org_id: orgId,
        source: srcTag ? `intake_form:${srcTag}` : "intake_form",
        stage: "new" as any,
        contact_role: role || null,
        website: website || null,
        engagement_type: engagementType,
        timeline: timeline || null,
        budget_range: budget || null,
        urgency: urgencyValue,
        notes: noteBlock,
      });
      if (leadError) throw leadError;

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
                      <p className="text-xs text-muted-foreground mt-0.5">
                        A PEC officer will review your submission within approximately 5 business days. If your project
                        aligns with active cohort capacity, we'll reach out to schedule a scoping call.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-3">
                    <Mail className="mt-0.5 h-4 w-4 shrink-0 text-accent-foreground" />
                    <div className="text-sm">
                      <p className="font-medium">Need to follow up?</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Email{" "}
                        <a href="mailto:pec@calpoly.edu" className="underline">
                          pec@calpoly.edu
                        </a>{" "}
                        referencing your company name.
                      </p>
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
              <h1 className="font-display text-3xl font-semibold leading-none tracking-tight">Work With PEC</h1>
              <CardDescription className="text-base">
                Poly-Engineering Consulting partners with companies, sponsors, and competition organizers. Tell us about
                your need and we'll route it to the right cohort.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">

                {/* Contact information */}
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
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" name="phone" type="tel" placeholder="+1 (555) 000-0000" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Your Role</Label>
                    <Input id="role" name="role" placeholder="VP Engineering" />
                  </div>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="company">Company / Organization *</Label>
                    <Input id="company" name="company" placeholder="Acme Corp" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="website">Company Website</Label>
                    <Input id="website" name="website" type="url" placeholder="https://acme.com" />
                  </div>
                </div>

                {/* Decision approver */}
                <div className="space-y-2">
                  <Label htmlFor="decision_approver">Who will approve decisions on your side? *</Label>
                  <Input
                    id="decision_approver"
                    name="decision_approver"
                    placeholder="e.g. Jane Smith, VP Engineering"
                    required
                  />
                  <p className="text-[11px] text-muted-foreground">
                    The person who can approve scope, deliverables, and timeline on your end.
                  </p>
                </div>

                {/* Engagement type */}
                <div className="space-y-2">
                  <Label>Engagement Type *</Label>
                  <Select value={engagementType} onValueChange={setEngagementType} required>
                    <SelectTrigger>
                      <SelectValue placeholder="What kind of engagement?" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contract">Contract: paid project work</SelectItem>
                      <SelectItem value="sponsorship">Sponsorship: fund a cohort or initiative</SelectItem>
                      <SelectItem value="competition">Competition collaboration</SelectItem>
                      <SelectItem value="exploratory">Exploratory conversation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Problem summary */}
                <div className="space-y-2">
                  <Label htmlFor="problem_summary">Problem summary *</Label>
                  <Textarea
                    id="problem_summary"
                    name="problem_summary"
                    rows={3}
                    placeholder="In 2–3 sentences: what challenge are you facing, what domain is it in (e.g. embedded firmware, mechanical design, data analysis), and what's driving the need now?"
                    required
                    minLength={20}
                  />
                </div>

                {/* Desired outcome */}
                <div className="space-y-2">
                  <Label htmlFor="desired_outcome">What does success look like? *</Label>
                  <Textarea
                    id="desired_outcome"
                    name="desired_outcome"
                    rows={2}
                    placeholder="e.g. A validated prototype and manufacturing plan that reduces assembly time by 20%, delivered within 12 weeks."
                    required
                    minLength={10}
                  />
                </div>

                {/* Deliverable preference */}
                <div className="space-y-2">
                  <Label>Preferred deliverable format *</Label>
                  <Select value={deliverablePreference} onValueChange={setDeliverablePreference} required>
                    <SelectTrigger>
                      <SelectValue placeholder="What output format do you need?" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="report">Report: written findings and recommendations</SelectItem>
                      <SelectItem value="deck">Deck: presentation for stakeholders</SelectItem>
                      <SelectItem value="prototype">Prototype: physical or functional build</SelectItem>
                      <SelectItem value="analysis">Analysis: data, model, or technical study</SelectItem>
                      <SelectItem value="recommendation">Recommendation: decision brief</SelectItem>
                      <SelectItem value="other">Other: describe in problem summary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Timeline and budget */}
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Timeline</Label>
                    <Select value={timeline} onValueChange={setTimeline}>
                      <SelectTrigger>
                        <SelectValue placeholder="When do you need this?" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="urgent">Urgent: within 4 weeks</SelectItem>
                        <SelectItem value="quarter">This quarter</SelectItem>
                        <SelectItem value="semester">This academic term</SelectItem>
                        <SelectItem value="flexible">Flexible</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Estimated Budget</Label>
                    <Select value={budget} onValueChange={setBudget}>
                      <SelectTrigger>
                        <SelectValue placeholder="Optional" />
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
                </div>

                {/* Data and resources */}
                <div className="space-y-2">
                  <Label htmlFor="data_available">Data and resources you can share</Label>
                  <Textarea
                    id="data_available"
                    name="data_available"
                    rows={2}
                    placeholder="e.g. CAD files, test data, system access, stakeholders willing to participate in weekly calls..."
                  />
                </div>

                {/* Constraints */}
                <div className="space-y-2">
                  <Label htmlFor="constraints">Constraints</Label>
                  <Textarea
                    id="constraints"
                    name="constraints"
                    rows={2}
                    placeholder="e.g. Manufacturing limits, compliance or safety requirements, regulatory restrictions, hard deadlines..."
                  />
                </div>

                {/* Sensitivity */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Sensitivity</Label>
                  <p className="text-[11px] text-muted-foreground">Check all that apply. We handle sensitive projects carefully.</p>
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="nda_needed"
                        checked={ndaNeeded}
                        onCheckedChange={(v) => setNdaNeeded(!!v)}
                      />
                      <Label htmlFor="nda_needed" className="text-sm font-normal cursor-pointer">
                        NDA required before sharing details
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="ip_concerns"
                        checked={ipConcerns}
                        onCheckedChange={(v) => setIpConcerns(!!v)}
                      />
                      <Label htmlFor="ip_concerns" className="text-sm font-normal cursor-pointer">
                        Involves patents, proprietary code, or IP concerns
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="proprietary_data"
                        checked={proprietaryData}
                        onCheckedChange={(v) => setProprietaryData(!!v)}
                      />
                      <Label htmlFor="proprietary_data" className="text-sm font-normal cursor-pointer">
                        Includes proprietary or sensitive data
                      </Label>
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground">
                  By submitting, you agree your inquiry will be reviewed by Poly-Engineering Consulting officers at Cal
                  Poly SLO. We do not share your information externally.
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
