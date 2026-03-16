"use client";

import { HelpCircle } from "lucide-react";

import { requestOnboardingTourStart } from "@/components/onboarding/tour";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function HelpMenu() {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open help menu" data-tour="help-menu-button">
              <HelpCircle className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent sideOffset={8} className="bg-zinc-900 text-zinc-50">
          <p>Need help? Open quick guidance and support options.</p>
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={requestOnboardingTourStart}>Take Tour Again</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => window.open("/help", "_blank", "noopener,noreferrer")}>
          Help Documentation
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => window.open("mailto:support@pulsekonnect.com", "_blank")}>
          Contact Support
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
