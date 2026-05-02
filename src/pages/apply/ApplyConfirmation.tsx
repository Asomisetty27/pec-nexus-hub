import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, Clock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function ApplyConfirmation() {
  const [params] = useSearchParams();
  const ref = params.get("ref");
  const intake = params.get("intake") === "1";
  const dup = params.get("dup") === "1";

  useEffect(() => {
    document.title = "Application received | PEC";
  }, []);

  return (
    <div className="py-20">
      <div className="container max-w-2xl">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardContent className="pt-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600/10">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
              <h1 className="mt-4 font-display text-3xl font-bold">
                {dup ? "You're already in our pool" : "Application received"}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {dup
                  ? "We already have your application in our intake pool. We've noted that you're still interested and will reach out when the next recruitment cycle opens."
                  : intake
                  ? "Your application has been received and added to our intake pool. PEC reviews applications during formal recruitment cycles in Fall and, when needed, Spring."
                  : "Thanks for applying to Poly-Engineering Consulting. We have your submission."}
              </p>
              {ref && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Reference: <span className="font-mono">{ref}</span>
                </p>
              )}

              <div className="mt-8 grid gap-3 text-left sm:grid-cols-2">
                <div className="rounded-md border border-border/60 p-4">
                  <Clock className="h-4 w-4 text-primary" />
                  <h3 className="mt-2 text-sm font-semibold">What happens next</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {intake
                      ? "Your application is held in our intake pool until the next recruitment cycle opens. No action is needed from you in the meantime."
                      : "Our cohort leads will review your application during this cycle. We aim to respond before the cycle closes."}
                  </p>
                </div>
                <div className="rounded-md border border-border/60 p-4">
                  <Mail className="h-4 w-4 text-primary" />
                  <h3 className="mt-2 text-sm font-semibold">{intake ? "When the cycle opens" : "If selected"}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {intake
                      ? "When the next cycle opens, your application is promoted into active review. If selected, we'll reach out by email."
                      : "We'll reach out by email to schedule a short interview. No status portal — just direct contact."}
                  </p>
                </div>
              </div>

              <div className="mt-8 flex justify-center">
                <Button asChild variant="outline">
                  <Link to="/">Back to home</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}