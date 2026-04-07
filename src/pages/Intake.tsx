import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Send, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function Intake() {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [inquiryType, setInquiryType] = useState("");
  const [budget, setBudget] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = (form.get("name") as string).trim();
    const email = (form.get("email") as string).trim();
    const company = (form.get("company") as string).trim();
    const description = (form.get("description") as string).trim();

    if (!name || !email || !company || !inquiryType || !description) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setSubmitting(true);
    try {
      // Create or find organization
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
          .insert({ name: company, type: "client" })
          .select("id")
          .single();
        if (newOrg) orgId = newOrg.id;
      }

      // Create lead
      const { error: leadError } = await supabase.from("leads").insert({
        contact_name: name,
        contact_email: email,
        org_id: orgId,
        source: "intake_form",
        stage: "new" as any,
        notes: `Type: ${inquiryType}\nBudget: ${budget || "Not specified"}\n\n${description}`,
      });

      if (leadError) throw leadError;

      setSubmitted(true);
      toast.success("Inquiry submitted! We'll be in touch within 48 hours.");
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
              <CardContent className="flex flex-col items-center py-16 text-center">
                <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mb-4">
                  <CheckCircle2 className="h-8 w-8 text-success" />
                </div>
                <h2 className="font-display text-2xl font-bold mb-2">Inquiry Received</h2>
                <p className="text-muted-foreground max-w-sm">
                  Thank you for reaching out. Our team will review your inquiry and get back to you within 48 hours.
                </p>
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
                Tell us about your project and we'll match you with the right team.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name *</Label>
                    <Input id="name" name="name" placeholder="Jane Smith" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input id="email" name="email" type="email" placeholder="jane@company.com" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company">Company / Organization *</Label>
                  <Input id="company" name="company" placeholder="Acme Corp" required />
                </div>
                <div className="space-y-2">
                  <Label>Inquiry Type *</Label>
                  <Select value={inquiryType} onValueChange={setInquiryType} required>
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
                  <Label htmlFor="description">Project Description *</Label>
                  <Textarea id="description" name="description" rows={5} placeholder="Describe your project, timeline, and any specific requirements..." required />
                </div>
                <div className="space-y-2">
                  <Label>Estimated Budget Range</Label>
                  <Select value={budget} onValueChange={setBudget}>
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
