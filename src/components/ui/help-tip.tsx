"use client";

import { HelpCircle } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type HelpTipProps = {
  text: string;
  side?: "top" | "right" | "bottom" | "left";
};

export function HelpTip({ text, side = "top" }: HelpTipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="Help"
          className="inline-flex h-5 w-5 items-center justify-center rounded-full text-zinc-400 hover:text-zinc-600"
        >
          <HelpCircle className="h-4 w-4" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent side={side} sideOffset={8} className="max-w-xs bg-zinc-900 text-zinc-50">
        <p>{text}</p>
      </TooltipContent>
    </Tooltip>
  );
}
