import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

const OPS_COHORT_NAME = "Ops / PM";

export interface CrmAccess {
  loading: boolean;
  canAccess: boolean;        // can view CRM at all
  isLeadership: boolean;     // can see analytics, all-companies
  isOpsMember: boolean;      // ops cohort member
}

/**
 * CRM access predicate:
 * - Admin / superadmin / board → full leadership access
 * - Ops / PM cohort members → standard CRM access
 * - Others → no access
 */
export function useCrmAccess(): CrmAccess {
  const { user, isAdmin, isBoardOrAdmin, loading: authLoading } = useAuth();
  const [isOpsMember, setIsOpsMember] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (!user) {
        if (!cancelled) {
          setIsOpsMember(false);
          setLoading(false);
        }
        return;
      }
      const { data } = await supabase
        .from("cohort_memberships")
        .select("cohorts!inner(name)")
        .eq("user_id", user.id);
      if (cancelled) return;
      const inOps = (data || []).some((row: any) => row.cohorts?.name === OPS_COHORT_NAME);
      setIsOpsMember(inOps);
      setLoading(false);
    };
    if (!authLoading) check();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  const isLeadership = isAdmin || isBoardOrAdmin;
  const canAccess = isLeadership || isOpsMember;

  return { loading: loading || authLoading, canAccess, isLeadership, isOpsMember };
}