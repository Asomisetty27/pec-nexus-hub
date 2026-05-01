import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { loadRecruitmentAccess, type RecruitmentAccess } from "@/lib/recruitment";

export function useRecruitmentAccess(): RecruitmentAccess {
  const { user, isAdmin } = useAuth();
  const [access, setAccess] = useState<RecruitmentAccess>({ canSeeRecruitment: false, isLead: false });

  useEffect(() => {
    let cancelled = false;
    if (!user) { setAccess({ canSeeRecruitment: false, isLead: false }); return; }
    (async () => {
      const a = await loadRecruitmentAccess(user.id, isAdmin);
      if (!cancelled) setAccess(a);
    })();
    return () => { cancelled = true; };
  }, [user, isAdmin]);

  return access;
}