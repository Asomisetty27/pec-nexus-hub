import { Badge } from "@/components/ui/badge";
import { User, Users } from "lucide-react";

interface Props {
  ownerType?: "individual" | "group" | null;
  ownerName?: string | null;
  groupName?: string | null;
  groupMemberCount?: number | null;
  className?: string;
  /** When set and ownerType is group, renders "Submitting on behalf of <Group>" copy. */
  submitting?: boolean;
}

export function DeliverableOwnerBadge({
  ownerType, ownerName, groupName, groupMemberCount, className, submitting,
}: Props) {
  if (ownerType === "group") {
    if (submitting) {
      return (
        <Badge variant="outline" className={`gap-1.5 text-[10px] ${className || ""}`}>
          <Users className="h-3 w-3" />
          Submitting on behalf of {groupName || "group"}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className={`gap-1.5 text-[10px] ${className || ""}`}>
        <Users className="h-3 w-3" />
        Group Owner: {groupName || "Unnamed group"}
        {typeof groupMemberCount === "number" && (
          <span className="text-muted-foreground">· {groupMemberCount} member{groupMemberCount === 1 ? "" : "s"}</span>
        )}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={`gap-1.5 text-[10px] ${className || ""}`}>
      <User className="h-3 w-3" />
      Owner: {ownerName || "Unassigned"}
    </Badge>
  );
}