import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Loader2 } from "lucide-react";

// PolyInnovate teaser + interest form. This is the demand-gauge instrument
// (vault: PolyInnovate logistics plan, "demand gates"): free to build, tracked
// by QR ?src= per surface, feeding the December full-vs-lean decision.
// Copy is deliberately minimal and evidence-grade: date + tracks only; venue,
// partners, and sanctioning are announced fall quarter once locked.

const TRACKS = [
  { key: "software_ai", name: "Software & AI", mode: "Compete", desc: "The hackathon. Build to a prompt in a day." },
  { key: "business", name: "Business & Marketing", mode: "Compete", desc: "The pitch. Crack a real prompt, present to judges." },
  { key: "hardware", name: "Hardware & Embedded", mode: "Showcase", desc: "Judged exhibits. Drones, boards, robots." },
  { key: "mech", name: "Mechanical & Manufacturing", mode: "Showcase", desc: "The big builds, judged on the floor." },
] as const;

const SCHOOLS = [
  { key: "calpoly", label: "Cal Poly SLO" },
  { key: "ucsb", label: "UCSB" },
  { key: "cuesta", label: "Cuesta" },
  { key: "other", label: "Other" },
] as const;

export default function PolyInnovate() {
  const [searchParams] = useSearchParams();
  // QR Studio tags every printed surface with ?src=; keep it on the signup so
  // the December demand read is attributable per surface (intake convention).
  const srcTag = (searchParams.get("src") ?? "").replace(/[^a-z0-9-]/gi, "-").slice(0, 40);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [school, setSchool] = useState<string>("calpoly");
  const [tracks, setTracks] = useState<string[]>([]);
  const [wantsExhibit, setWantsExhibit] = useState(false);
  const [website, setWebsite] = useState(""); // honeypot; humans never see it
  const [state, setState] = useState<"idle" | "sending" | "done" | "dup">("idle");
  const [error, setError] = useState("");

  const toggleTrack = (key: string) =>
    setTracks((t) => (t.includes(key) ? t.filter((k) => k !== key) : [...t, key]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (website) { setState("done"); return; } // bot filled the honeypot; pretend success
    const clean = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) { setError("Enter a valid email."); return; }
    setError("");
    setState("sending");
    const { error: err } = await (supabase as any).from("polyinnovate_interest").insert({
      email: clean,
      name: name.trim() || null,
      school,
      tracks,
      wants_exhibit: wantsExhibit,
      source: srcTag || null,
    });
    if (err) {
      if (err.code === "23505") { setState("dup"); return; } // already on the list
      setState("idle");
      setError("Something went wrong. Try again in a minute.");
      return;
    }
    setState("done");
  };

  return (
    <div className="reg-marks bg-grid">
      {/* hero */}
      <section className="border-b border-foreground">
        <div className="container pb-14 pt-20 md:pt-28">
          <div className="flex flex-wrap items-center gap-3">
            <span className="stamp stamp-tilt text-accent">april 10, 2027 &middot; free to attend</span>
            <span className="label text-muted-foreground">cal poly &middot; san luis obispo</span>
          </div>
          <h1 className="mt-6 font-display text-6xl leading-[0.95] tracking-tight sm:text-7xl lg:text-8xl">
            Poly<span className="text-accent">Innovate</span>
          </h1>
          <p className="mt-6 max-w-2xl text-xl leading-snug sm:text-2xl">
            The one day Cal Poly engineering competes in public.
          </p>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            A campus festival of building. A same-day hackathon, a live pitch
            competition, and a judged showcase of the year's best student builds,
            capped with an evening awards show. Every discipline gets a stage.
          </p>
        </div>
      </section>

      {/* tracks */}
      <section className="border-b border-foreground bg-card">
        <div className="container py-12">
          <span className="label text-muted-foreground">four tracks &middot; compete or showcase</span>
          <div className="mt-6 grid gap-px border border-foreground bg-foreground sm:grid-cols-2">
            {TRACKS.map((t) => (
              <div key={t.key} className="bg-card p-6">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-display text-2xl">{t.name}</h3>
                  <span className="label text-accent">{t.mode}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{t.desc}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            No all-nighter. Teams of 2 to 4, matched on site if you come solo, and a
            beginner track with its own prizes. First event? This one is built for you.
          </p>
        </div>
      </section>

      {/* interest form */}
      <section>
        <div className="container py-14">
          <div className="max-w-2xl">
            <span className="label text-muted-foreground">registration opens winter quarter</span>
            <h2 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">Be first in.</h2>

            {state === "done" || state === "dup" ? (
              <div className="mt-8 border border-foreground bg-card p-8">
                <div className="flex items-start gap-3">
                  <Check className="mt-1 h-5 w-5 text-accent" />
                  <div>
                    <p className="font-display text-2xl">
                      {state === "dup" ? "You're already on the list." : "You're on the list."}
                    </p>
                    <p className="mt-2 text-muted-foreground">
                      We'll email you when registration opens. Tell a friend who builds.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={submit} className="mt-8 space-y-6">
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="pi-email">Email *</Label>
                    <Input id="pi-email" type="email" required placeholder="you@calpoly.edu"
                      value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pi-name">Name</Label>
                    <Input id="pi-name" placeholder="Optional" value={name}
                      onChange={(e) => setName(e.target.value)} maxLength={120} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>School</Label>
                  <div className="flex flex-wrap gap-2">
                    {SCHOOLS.map((s) => (
                      <button key={s.key} type="button" onClick={() => setSchool(s.key)}
                        aria-pressed={school === s.key}
                        className={`label border px-4 py-2 transition-colors ${
                          school === s.key
                            ? "border-accent bg-accent text-accent-foreground"
                            : "border-foreground hover:border-accent hover:text-accent"
                        }`}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Which tracks interest you?</Label>
                  <div className="flex flex-wrap gap-2">
                    {TRACKS.map((t) => (
                      <button key={t.key} type="button" onClick={() => toggleTrack(t.key)}
                        aria-pressed={tracks.includes(t.key)}
                        className={`label border px-4 py-2 transition-colors ${
                          tracks.includes(t.key)
                            ? "border-accent bg-accent text-accent-foreground"
                            : "border-foreground hover:border-accent hover:text-accent"
                        }`}>
                        {t.name}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex cursor-pointer items-start gap-3 text-sm">
                  <input type="checkbox" checked={wantsExhibit}
                    onChange={(e) => setWantsExhibit(e.target.checked)} className="mt-1" />
                  <span>
                    I'd want to <span className="font-medium">exhibit</span> a project or club
                    build on the showcase floor.
                  </span>
                </label>

                {/* honeypot: hidden from humans, tempting to bots */}
                <div className="absolute -left-[9999px]" aria-hidden="true">
                  <label htmlFor="pi-website">Website</label>
                  <input id="pi-website" tabIndex={-1} autoComplete="off"
                    value={website} onChange={(e) => setWebsite(e.target.value)} />
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <Button type="submit" disabled={state === "sending"}
                  className="label bg-accent px-8 py-6 text-accent-foreground hover:bg-primary hover:text-primary-foreground">
                  {state === "sending" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Count me in
                </Button>
              </form>
            )}

            <p className="mt-10 text-sm text-muted-foreground">
              Hosted by Poly-Engineering Consulting with Cal Poly's builder clubs.
              Venue, partners, and full details announced fall quarter.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
