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
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center justify-center ml-1"
            onClick={(e) => e.preventDefault()}
          >
            <HelpCircle className="h-5 w-5 text-foreground/60 hover:text-primary transition-colors" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs bg-popover text-popover-foreground border">
          <p className="text-sm">{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
