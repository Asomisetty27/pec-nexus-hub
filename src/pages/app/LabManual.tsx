import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { BookOpen, ChevronLeft, ChevronRight, CheckCircle2, Send, Lock, ArrowLeft, Maximize2, Minimize2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export default function LabManual() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [manual, setManual] = useState<any>(null);
  const [steps, setSteps] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [activeStep, setActiveStep] = useState(0);
  const [focusMode, setFocusMode] = useState(false);
  const [submissionText, setSubmissionText] = useState("");
  const [submissionLink, setSubmissionLink] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !user) return;
    const load = async () => {
      const [manualRes, stepsRes, subsRes] = await Promise.all([
        supabase.from("lab_manuals").select("*, cohorts(name)").eq("id", id).single(),
        supabase.from("lab_steps").select("*").eq("manual_id", id).order("order_index"),
        supabase.from("submissions").select("*, reviews(*)").eq("user_id", user.id),
      ]);
      setManual(manualRes.data);
      setSteps(stepsRes.data || []);
      // Filter submissions for steps in this manual
      const stepIds = (stepsRes.data || []).map((s: any) => s.id);
      setSubmissions((subsRes.data || []).filter((s: any) => stepIds.includes(s.step_id)));
      setLoading(false);
    };
    load();
  }, [id, user]);

  const getStepSubmission = (stepId: string) => submissions.find(s => s.step_id === stepId);
  const isStepComplete = (stepId: string) => {
    const sub = getStepSubmission(stepId);
    return sub && (sub.status === "approved" || sub.status === "submitted");
  };
  const completedCount = steps.filter(s => isStepComplete(s.id)).length;
  const progress = steps.length > 0 ? (completedCount / steps.length) * 100 : 0;

  const isStepUnlocked = (index: number) => {
    if (index === 0) return true;
    return isStepComplete(steps[index - 1]?.id);
  };

  const handleSubmit = async () => {
    if (!user || !steps[activeStep]) return;
    setSubmitting(true);
    const { error } = await supabase.from("submissions").insert({
      step_id: steps[activeStep].id,
      user_id: user.id,
      content: submissionText,
      link_url: submissionLink || null,
      status: "submitted",
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Submission sent!");
      setSubmissionText("");
      setSubmissionLink("");
      // Refresh submissions
      const { data } = await supabase.from("submissions").select("*, reviews(*)").eq("user_id", user.id);
      const stepIds = steps.map((s: any) => s.id);
      setSubmissions((data || []).filter((s: any) => stepIds.includes(s.step_id)));
    }
    setSubmitting(false);
  };

  if (loading) {
    return <div className="space-y-4">{[1, 2].map(i => <Card key={i} className="h-32 animate-pulse bg-muted/30" />)}</div>;
  }

  if (!manual) {
    return (
      <div className="text-center py-20">
        <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
        <p className="text-muted-foreground">Lab manual not found.</p>
        <Button variant="ghost" className="mt-4" onClick={() => navigate("/app/cohort")}>Back to Cohort Hub</Button>
      </div>
    );
  }

  const currentStep = steps[activeStep];
  const currentSubmission = currentStep ? getStepSubmission(currentStep.id) : null;
  const unlocked = isStepUnlocked(activeStep);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`${focusMode ? "fixed inset-0 z-50 bg-background p-6 overflow-auto" : "max-w-5xl space-y-6"}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {!focusMode && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/app/cohort")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{(manual as any).cohorts?.name} • Lab Manual</p>
            <h1 className="font-display text-xl font-bold">{manual.title}</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ProgressRing progress={progress} size={48} strokeWidth={4}>
            <span className="text-[10px] font-mono font-bold">{completedCount}/{steps.length}</span>
          </ProgressRing>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setFocusMode(!focusMode)} title={focusMode ? "Exit focus" : "Focus mode"}>
            {focusMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Steps sidebar */}
        <div className={`${focusMode ? "lg:col-span-1" : "lg:col-span-1"} space-y-1`}>
          {steps.map((step, i) => {
            const completed = isStepComplete(step.id);
            const locked = !isStepUnlocked(i);
            return (
              <motion.button
                key={step.id}
                whileHover={locked ? {} : { x: 2 }}
                onClick={() => !locked && setActiveStep(i)}
                disabled={locked}
                className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all text-sm ${
                  activeStep === i
                    ? "bg-accent/10 border border-accent/30 text-foreground"
                    : locked
                    ? "text-muted-foreground/40 cursor-not-allowed"
                    : "hover:bg-muted/50 text-muted-foreground"
                }`}
              >
                {completed ? (
                  <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                ) : locked ? (
                  <Lock className="h-4 w-4 shrink-0" />
                ) : (
                  <div className="h-4 w-4 rounded-full border-2 border-current shrink-0" />
                )}
                <span className="truncate">{step.title}</span>
              </motion.button>
            );
          })}
        </div>

        {/* Step Content */}
        <div className="lg:col-span-3">
          <AnimatePresence mode="wait">
            {currentStep && (
              <motion.div
                key={currentStep.id}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2 }}
              >
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-mono text-muted-foreground uppercase">Step {activeStep + 1} of {steps.length}</p>
                        <CardTitle className="text-lg font-sans">{currentStep.title}</CardTitle>
                      </div>
                      {currentSubmission && (
                        <Badge variant={currentSubmission.status === "approved" ? "default" : "secondary"} className="text-[10px] font-mono">
                          {currentSubmission.status}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Content */}
                    {!unlocked ? (
                      <div className="flex flex-col items-center py-8 text-muted-foreground">
                        <Lock className="h-8 w-8 mb-2" />
                        <p className="text-sm">Complete the previous step to unlock this one.</p>
                      </div>
                    ) : (
                      <>
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <div className="whitespace-pre-wrap text-sm leading-relaxed">{currentStep.content || "No content yet."}</div>
                        </div>

                        {/* Submission form */}
                        {!currentSubmission ? (
                          <div className="border-t pt-4 space-y-3">
                            <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Submit your work</p>
                            <Input
                              placeholder="Link to your work (optional)"
                              value={submissionLink}
                              onChange={e => setSubmissionLink(e.target.value)}
                              className="h-9"
                            />
                            <Textarea
                              placeholder="Notes, explanation, or paste content..."
                              value={submissionText}
                              onChange={e => setSubmissionText(e.target.value)}
                              rows={4}
                            />
                            <Button onClick={handleSubmit} disabled={submitting || (!submissionText && !submissionLink)} className="gap-2">
                              <Send className="h-3.5 w-3.5" />
                              {submitting ? "Submitting..." : "Submit"}
                            </Button>
                          </div>
                        ) : (
                          <div className="border-t pt-4">
                            <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">Your Submission</p>
                            <div className="rounded-lg bg-muted/30 p-3 text-sm">{currentSubmission.content}</div>
                            {currentSubmission.link_url && (
                              <a href={currentSubmission.link_url} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline mt-1 inline-block">{currentSubmission.link_url}</a>
                            )}
                            {/* Reviews */}
                            {currentSubmission.reviews?.length > 0 && (
                              <div className="mt-4 space-y-2">
                                <p className="text-xs font-mono uppercase text-muted-foreground">Feedback</p>
                                {currentSubmission.reviews.map((r: any) => (
                                  <div key={r.id} className="rounded-lg border p-3 bg-card">
                                    <p className="text-sm">{r.comments || "No comments"}</p>
                                    <p className="text-[10px] font-mono text-muted-foreground mt-1">{r.status}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}

                    {/* Navigation */}
                    <div className="flex justify-between pt-2">
                      <Button variant="ghost" size="sm" disabled={activeStep === 0} onClick={() => setActiveStep(activeStep - 1)}>
                        <ChevronLeft className="h-3 w-3 mr-1" /> Previous
                      </Button>
                      <Button variant="ghost" size="sm" disabled={activeStep >= steps.length - 1 || !isStepUnlocked(activeStep + 1)} onClick={() => setActiveStep(activeStep + 1)}>
                        Next <ChevronRight className="h-3 w-3 ml-1" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
