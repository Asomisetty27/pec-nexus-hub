import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy } from "lucide-react";

export default function Competitions() {
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Competitions</h1>
      <Card className="flex flex-col items-center justify-center py-12">
        <Trophy className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">No active competitions.</p>
      </Card>
    </div>
  );
}
