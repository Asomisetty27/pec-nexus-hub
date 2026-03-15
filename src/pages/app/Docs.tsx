import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Plus, Search, FolderOpen, ChevronRight, Clock } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.2 } } };

export default function Docs() {
  const { user, isAdmin, isBoardOrAdmin } = useAuth();
  const [govDocs, setGovDocs] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [govRes, docRes] = await Promise.all([
        supabase.from("governance_docs").select("*").order("updated_at", { ascending: false }),
        supabase.from("documents").select("*").order("updated_at", { ascending: false }).limit(50),
      ]);
      setGovDocs(govRes.data || []);
      setDocuments(docRes.data || []);
      setLoading(false);
    };
    load();
  }, []);

  const handleCreateDoc = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const { error } = await supabase.from("documents").insert({
      title: f.get("title") as string,
      content: f.get("content") as string,
      doc_type: f.get("doc_type") as string,
      author_id: user!.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Document created");
    setDialogOpen(false);
    const { data } = await supabase.from("documents").select("*").order("updated_at", { ascending: false }).limit(50);
    setDocuments(data || []);
  };

  const filteredGov = govDocs.filter(d => d.title.toLowerCase().includes(search.toLowerCase()) || d.category?.toLowerCase().includes(search.toLowerCase()));
  const filteredDocs = documents.filter(d => d.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 max-w-5xl">
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Documents & SOPs</h1>
          <p className="text-xs text-muted-foreground font-mono">{govDocs.length + documents.length} documents</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="h-3.5 w-3.5" /> New Document</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Document</DialogTitle></DialogHeader>
            <form onSubmit={handleCreateDoc} className="space-y-4">
              <div className="space-y-2"><Label>Title</Label><Input name="title" required placeholder="Project Charter" /></div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select name="doc_type" defaultValue="general">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="charter">Charter</SelectItem>
                    <SelectItem value="report">Report</SelectItem>
                    <SelectItem value="research">Research</SelectItem>
                    <SelectItem value="decision_log">Decision Log</SelectItem>
                    <SelectItem value="risk_log">Risk Log</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Content</Label><Textarea name="content" rows={6} placeholder="Start writing..." /></div>
              <Button type="submit" className="w-full">Create</Button>
            </form>
          </DialogContent>
        </Dialog>
      </motion.div>

      <motion.div variants={item} className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search documents..." className="pl-9 h-9 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
      </motion.div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All Documents</TabsTrigger>
          <TabsTrigger value="governance">Governance & SOPs</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2">{[1,2,3].map(i => <Card key={i} className="h-24 animate-pulse bg-muted/30" />)}</div>
          ) : filteredDocs.length === 0 ? (
            <Card className="flex flex-col items-center py-12">
              <FileText className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No documents yet. Create one to get started.</p>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filteredDocs.map(doc => (
                <motion.div key={doc.id} variants={item}>
                  <Card className="cursor-pointer hover:border-accent/40 transition-all group" onClick={() => setSelectedDoc(doc)}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-1">
                        <h3 className="text-sm font-semibold">{doc.title}</h3>
                        <Badge variant="outline" className="text-[9px] font-mono shrink-0">{doc.doc_type}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{doc.content?.slice(0, 100) || "Empty document"}</p>
                      <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(doc.updated_at).toLocaleDateString()}
                        <span className="font-mono">v{doc.version}</span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="governance" className="mt-4">
          {filteredGov.length === 0 ? (
            <Card className="flex flex-col items-center py-12">
              <FolderOpen className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No governance documents published yet.</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredGov.map(doc => (
                <motion.div key={doc.id} variants={item}>
                  <Card className="cursor-pointer hover:border-accent/40 transition-all group" onClick={() => setSelectedDoc(doc)}>
                    <CardContent className="flex items-center gap-4 p-4">
                      <FileText className="h-5 w-5 text-accent shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{doc.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[9px] font-mono">{doc.category}</Badge>
                          <Badge variant="secondary" className="text-[9px] font-mono">{doc.visibility}</Badge>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors shrink-0" />
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Document Viewer */}
      <Dialog open={!!selectedDoc} onOpenChange={() => setSelectedDoc(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          {selectedDoc && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedDoc.title}</DialogTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-[9px] font-mono">{selectedDoc.doc_type || selectedDoc.category || "general"}</Badge>
                  <span className="text-[10px] text-muted-foreground font-mono">v{selectedDoc.version}</span>
                </div>
              </DialogHeader>
              <div className="prose prose-sm dark:prose-invert max-w-none mt-4">
                <div className="whitespace-pre-wrap text-sm leading-relaxed">{selectedDoc.content || "No content."}</div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
