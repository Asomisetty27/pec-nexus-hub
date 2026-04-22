import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GraduationCap, Swords } from "lucide-react";
import Grind from "./Grind";
import Academy from "./Academy";

/**
 * Training = unified Learn + Grind shell.
 * Grind is the default tab and the center of gravity.
 * Learn (formerly Academy) is preserved as structured onboarding/reference.
 */
export default function Training() {
  const [params, setParams] = useSearchParams();
  const tabFromUrl = params.get("tab");
  const initial = tabFromUrl === "learn" ? "learn" : "grind";
  const [tab, setTab] = useState<"grind" | "learn">(initial);

  useEffect(() => {
    if (tab !== (tabFromUrl ?? "grind")) {
      const next = new URLSearchParams(params);
      if (tab === "grind") next.delete("tab"); else next.set("tab", tab);
      setParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <div className="container mx-auto max-w-7xl space-y-4 p-6">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-bold tracking-tight">Training</h1>
        <p className="text-sm text-muted-foreground">
          Learn the fundamentals. Grind to stay sharp.
        </p>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "grind" | "learn")}>
        <TabsList>
          <TabsTrigger value="grind" className="gap-2">
            <Swords className="h-4 w-4" /> Grind
          </TabsTrigger>
          <TabsTrigger value="learn" className="gap-2">
            <GraduationCap className="h-4 w-4" /> Learn
          </TabsTrigger>
        </TabsList>

        <TabsContent value="grind" className="mt-4 -mx-6">
          {/* Grind already supplies its own container/padding */}
          <Grind />
        </TabsContent>

        <TabsContent value="learn" className="mt-6 space-y-2">
          <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
            Onboarding · Concepts · References
          </p>
          <Academy />
        </TabsContent>
      </Tabs>
    </div>
  );
}