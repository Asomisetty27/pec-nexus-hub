import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface SectionExplainerProps {
  text: string;
  className?: string;
}

/** A subtle, non-intrusive one-liner that explains what a section is for. */
export function SectionExplainer({ text, className = "" }: SectionExplainerProps) {
  return (
    <p className={`text-[11px] text-muted-foreground leading-relaxed ${className}`}>
      {text}
    </p>
  );
}

interface InfoTipProps {
  tip: string;
  children: React.ReactNode;
}

/** Wraps any element with a hover tooltip explanation. */
export function InfoTip({ tip, children }: InfoTipProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-[220px] text-xs">
          {tip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Small inline info icon with tooltip. */
export function InfoDot({ tip }: { tip: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="h-3 w-3 text-muted-foreground/50 hover:text-muted-foreground cursor-help inline-block ml-1" />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[240px] text-xs leading-relaxed">
          {tip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
