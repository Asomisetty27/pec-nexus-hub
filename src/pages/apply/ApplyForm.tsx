import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { z } from "zod";
import { ArrowLeft, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const FormSchema = z.object({
  full_name: z.string().trim().min(2, "Required").max(120),
  email: z.string().trim().email("Valid email required").max(255),
  phone: z.string().trim().min(7, "Required").max(40),
  calpoly_email: z.string().trim().email().max(255).optional().or(z.literal("")),
  major: z.string().trim().min(2, "Required").max(120),
  year_standing: z.string().min(1, "Required"),
  expected_grad_term: z.string().trim().min(2, "Required").max(40),
  portfolio_url: z.string().trim().url().max(500).optional().or(z.literal("")),
  linkedin_url: z.string().trim().url().max(500).optional().or(z.literal("")),
  relevant_experience: z.string().trim().min(20, "At least 20 characters").max(4000),
  why_pec: z.string().trim().min(20, "At least 20 characters").max(4000),
  availability: z.string().trim().min(5, "Required").max(1000),
  source: z.string().min(1, "Required"),
  source_detail: z.string().trim().max(255).optional(),
});

const MAX_RESUME_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const SOURCES = [
  { value: "website", label: "PEC website" },
  { value: "flyer", label: "Flyer / poster" },
  { value: "referral", label: "Referral from a member" },
  { value: "event", label: "Tabling / campus event" },
  { value: "info_session", label: "Info session" },
  { value: "social_media", label: "Social media" },
  { value: "search", label: "Search engine" },
  { value: "professor", label: "Professor / advisor" },
  { value: "club_fair", label: "Club fair" },
  { value: "other", label: "Other" },
];

const YEAR_STANDING = [
  { value: "freshman", label: "Freshman" },
  { value: "sophomore", label: "Sophomore" },
  { value: "junior", label: "Junior" },
  { value: "senior", label: "Senior" },
  { value: "graduate", label: "Graduate" },
  { value: "other", label: "Other" },
];

export default function ApplyForm() {
  const navigate = useNavigate();
  const [checkingCycle, setCheckingCycle] = useState(true);
  const [cycleOpen, setCycleOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resume, setResume] = useState<File | null>(null);
  const [yearStanding, setYearStanding] = useState("");
  const [source, setSource] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    document.title = "Apply | Application Form | PEC";
    (async () => {
      const { data } = await supabase.rpc("get_active_application_cycle");
      const row = Array.isArray(data) ? data[0] : null;
      setCycleOpen(!!row);
      setCheckingCycle(false);
    })();
  }, []);

  const handleResumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) { setResume(null); return; }
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Resume must be a PDF, DOC, or DOCX file.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_RESUME_BYTES) {
      toast.error("Resume must be 5 MB or smaller.");
      e.target.value = "";
      return;
    }
    setResume(file);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    const fd = new FormData(e.currentTarget);
    const fields: Record<string, string> = {};
    for (const [k, v] of fd.entries()) {
      if (typeof v === "string") fields[k] = v;
    }
    fields.year_standing = yearStanding;
    fields.source = source;

    const parsed = FormSchema.safeParse(fields);
    if (!parsed.success) {
      const first = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0];
      setError(first ?? "Please check the form for errors.");
      return;
    }
    if (!resume) {
      setError("Please attach your resume.");
      return;
    }

    setSubmitting(true);
    try {
      const upload = new FormData();
      Object.entries(parsed.data).forEach(([k, v]) => upload.append(k, String(v ?? "")));
      upload.append("honeypot", fields.honeypot || "");
      upload.append("resume", resume);

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const url = `https://${projectId}.functions.supabase.co/submit-application`;

      const res = await fetch(url, { method: "POST", body: upload });
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg =
          res.status === 409 ? "You've already submitted an application for this cycle." :
          res.status === 410 ? "Applications are not currently open." :
          res.status === 429 ? "Too many submissions from this network. Please try again later." :
          body?.error ?? "Submission failed. Please try again.";
        setError(typeof msg === "string" ? msg : "Submission failed.");
        setSubmitting(false);
        return;
      }

      navigate(`/apply/confirmation?ref=${encodeURIComponent(body?.ref ?? "")}`);
    } catch (err: any) {
      setError(err?.message ?? "Network error. Please try again.");
      setSubmitting(false);
    }
  };

  if (checkingCycle) {
    return (
      <div className="container max-w-3xl py-20 text-center text-sm text-muted-foreground">
        Checking application status…
      </div>
    );
  }

  if (!cycleOpen) {
    return (
      <div className="container max-w-2xl py-20 text-center">
        <h1 className="font-display text-3xl font-bold">Applications are closed</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          The current recruitment cycle isn't open. The next cycle will be posted on the apply page.
        </p>
        <Button asChild className="mt-6" variant="outline">
          <Link to="/apply"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="py-12 md:py-16">
      <div className="container max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Button asChild variant="ghost" size="sm" className="mb-4">
            <Link to="/apply"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
          </Button>
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-2xl">Membership application</CardTitle>
              <CardDescription>
                All fields marked required. Take your time — we read every application.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form ref={formRef} onSubmit={handleSubmit} className="space-y-6" noValidate>
                {/* honeypot */}
                <div className="hidden" aria-hidden="true">
                  <Label htmlFor="honeypot">Leave blank</Label>
                  <Input id="honeypot" name="honeypot" tabIndex={-1} autoComplete="off" />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="full_name">Full name *</Label>
                    <Input id="full_name" name="full_name" required maxLength={120} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email *</Label>
                    <Input id="email" name="email" type="email" required maxLength={255} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Phone *</Label>
                    <Input id="phone" name="phone" type="tel" required maxLength={40} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="calpoly_email">Cal Poly email (optional)</Label>
                    <Input id="calpoly_email" name="calpoly_email" type="email" maxLength={255} />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="major">Major *</Label>
                    <Input id="major" name="major" required maxLength={120} placeholder="e.g. Computer Engineering" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="year_standing">Year standing *</Label>
                    <Select value={yearStanding} onValueChange={setYearStanding}>
                      <SelectTrigger id="year_standing"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {YEAR_STANDING.map((y) => (
                          <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="expected_grad_term">Expected graduation term *</Label>
                    <Input id="expected_grad_term" name="expected_grad_term" required maxLength={40} placeholder="e.g. Spring 2027" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="resume">Resume *</Label>
                  <Input id="resume" type="file" accept=".pdf,.doc,.docx" onChange={handleResumeChange} />
                  <p className="text-xs text-muted-foreground">PDF, DOC, or DOCX. 5 MB max.</p>
                  {resume && (
                    <p className="text-xs text-emerald-600">
                      <Upload className="mr-1 inline h-3 w-3" />
                      {resume.name} ({(resume.size / 1024).toFixed(0)} KB)
                    </p>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="portfolio_url">Portfolio URL (optional)</Label>
                    <Input id="portfolio_url" name="portfolio_url" type="url" maxLength={500} placeholder="https://" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="linkedin_url">LinkedIn URL (optional)</Label>
                    <Input id="linkedin_url" name="linkedin_url" type="url" maxLength={500} placeholder="https://" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="relevant_experience">Relevant experience *</Label>
                  <Textarea
                    id="relevant_experience" name="relevant_experience" rows={5} required
                    maxLength={4000}
                    placeholder="Projects, classes, jobs, internships, hardware/software you've built. Be specific."
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="why_pec">Why PEC? *</Label>
                  <Textarea
                    id="why_pec" name="why_pec" rows={5} required maxLength={4000}
                    placeholder="Why us, specifically? What do you want to build or learn?"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="availability">Availability *</Label>
                  <Textarea
                    id="availability" name="availability" rows={3} required maxLength={1000}
                    placeholder="Hours per week, conflicts, busy quarters, etc."
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="source">How did you hear about PEC? *</Label>
                    <Select value={source} onValueChange={setSource}>
                      <SelectTrigger id="source"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {SOURCES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="source_detail">Source detail (optional)</Label>
                    <Input id="source_detail" name="source_detail" maxLength={255} placeholder="e.g. friend's name" />
                  </div>
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="flex items-center justify-end gap-3 pt-2">
                  <Button type="submit" size="lg" disabled={submitting}>
                    {submitting ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting…</>
                    ) : "Submit application"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}