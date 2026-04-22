import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Pin, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRecentItems } from "@/hooks/useRecentItems";

export function ResumeStrip() {
  const navigate = useNavigate();
  const { items, pinned, unpinItem } = useRecentItems(6);

  if (items.length === 0 && pinned.length === 0) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      <Card className="overflow-hidden">
        <CardContent className="p-4 space-y-3">
          {pinned.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Pin className="h-3 w-3 text-accent-foreground" />
                <p className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">Pinned</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {pinned.map(p => (
                  <div key={p.id} className="group flex items-center gap-1 rounded-md border bg-muted/30 hover:bg-muted/60 transition-colors">
                    <button onClick={() => navigate(p.link)} className="px-2.5 py-1 text-xs font-medium">
                      {p.label}
                    </button>
                    <button
                      onClick={() => unpinItem(p.id)}
                      className="px-1.5 py-1 text-muted-foreground/50 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity text-[10px]"
                      title="Unpin"
                    >×</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {items.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <p className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">Pick up where you left off</p>
              </div>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {items.slice(0, 4).map(r => (
                  <Button
                    key={r.id}
                    variant="ghost"
                    onClick={() => navigate(r.link)}
                    className="h-auto justify-between px-2.5 py-2 text-left hover:bg-muted/60"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{r.label}</p>
                      <p className="text-[10px] text-muted-foreground capitalize">{r.item_type.replace("_"," ")}</p>
                    </div>
                    <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0 ml-2" />
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
