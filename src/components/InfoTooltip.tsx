import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface InfoTooltipProps {
  content: string;
}

export const InfoTooltip = ({ content }: InfoTooltipProps) => {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center justify-center ml-1"
            onClick={(e) => e.preventDefault()}
          >
            <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
          </button>
        </TooltipTrigger>
        <TooltipContent 
          className="max-w-sm bg-background text-foreground border-border shadow-lg p-4 z-[9999]" 
          side="right"
          align="start"
          sideOffset={10}
          alignOffset={-10}
          collisionPadding={20}
          avoidCollisions={true}
        >
          <p className="text-sm leading-relaxed">{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
