import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";

export default function Docs() {
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Documents & SOPs</h1>
      <Card className="flex flex-col items-center justify-center py-12">
        <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">No documents published yet.</p>
      </Card>
    </div>
  );
}
