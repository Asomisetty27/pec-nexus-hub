import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Mail, Phone, Linkedin, Building2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function CrmContacts() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("company_contacts")
      .select("*, organizations!inner(id, name, is_company_relation)")
      .eq("organizations.is_company_relation", true)
      .order("is_primary", { ascending: false })
      .order("full_name")
      .then(({ data }) => {
        setContacts(data || []);
        setLoading(false);
      });
  }, []);

  const filtered = contacts.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.full_name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.title?.toLowerCase().includes(q) ||
      c.organizations?.name?.toLowerCase().includes(q)
    );
  });

  if (loading) return <div className="h-64 animate-pulse rounded-lg bg-muted/30" />;

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search by name, email, title, or company…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />
      {filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm font-medium mb-1">No contacts found</p>
          <p className="text-[12px] text-muted-foreground">
            Add contacts from a company&apos;s detail page.
          </p>
        </Card>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <Card key={c.id} className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold truncate">{c.full_name}</p>
                    {c.is_primary && (
                      <Badge variant="outline" className="text-[8px] font-mono">
                        Primary
                      </Badge>
                    )}
                  </div>
                  {c.title && <p className="text-[11px] text-muted-foreground truncate">{c.title}</p>}
                  <button
                    onClick={() => navigate(`/app/crm/c/${c.organization_id}`)}
                    className="mt-1 flex items-center gap-1 text-[11px] text-accent-foreground hover:underline"
                  >
                    <Building2 className="h-3 w-3" />
                    {c.organizations?.name}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-foreground">
                {c.email && (
                  <a href={`mailto:${c.email}`} className="flex items-center gap-1 hover:text-foreground">
                    <Mail className="h-3 w-3" />
                  </a>
                )}
                {c.phone && (
                  <a href={`tel:${c.phone}`} className="flex items-center gap-1 hover:text-foreground">
                    <Phone className="h-3 w-3" />
                  </a>
                )}
                {c.linkedin_url && (
                  <a
                    href={c.linkedin_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    <Linkedin className="h-3 w-3" />
                  </a>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}