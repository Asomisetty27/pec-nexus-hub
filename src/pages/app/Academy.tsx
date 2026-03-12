import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap } from "lucide-react";

export default function Academy() {
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Training Academy</h1>
      <Card className="flex flex-col items-center justify-center py-12">
        <GraduationCap className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">Courses coming soon. Check back later.</p>
      </Card>
    </div>
  );
}
