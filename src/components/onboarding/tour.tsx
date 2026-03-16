"use client";

import * as React from "react";
import introJs from "intro.js";
import "intro.js/minified/introjs.min.css";

import { hasSeenTour, setTourSeen } from "@/lib/onboarding/local-progress";

export const START_ONBOARDING_TOUR_EVENT = "pk:start-onboarding-tour";

type TourStepConfig = {
  selector?: string;
  title?: string;
  intro: string;
  position?: "auto" | "top" | "right" | "bottom" | "left";
};

const TOUR_STEPS: TourStepConfig[] = [
  {
    title: "Welcome",
    intro: "Welcome to PulseKonnect! Let\'s take a quick tour of the platform.",
  },
  {
    selector: "[data-tour='dashboard-cards']",
    title: "Dashboard",
    intro: "This is your dashboard. See lead counts and recent activity here.",
    position: "bottom",
  },
  {
    selector: "[data-tour='new-lead-button']",
    title: "Add a Lead",
    intro: "Click here to add a new lead manually.",
    position: "bottom",
  },
  {
    selector: "[data-tour='sidebar-leads']",
    title: "Leads Navigation",
    intro: "Click Leads in the sidebar to see all your leads.",
    position: "right",
  },
  {
    selector: "[data-tour='lead-status-dropdown']",
    title: "Lead Status",
    intro: "Change lead status as you progress through follow-up.",
    position: "bottom",
  },
  {
    title: "Complete",
    intro: "You\'re all set! Click the help icon (?) anytime for assistance.",
  },
];

function toIntroStep(step: TourStepConfig): Record<string, unknown> | null {
  if (!step.selector) {
    return {
      title: step.title,
      intro: step.intro,
    };
  }

  const element = document.querySelector(step.selector);
  if (!element) return null;

  return {
    element: element as HTMLElement,
    title: step.title,
    intro: step.intro,
    position: step.position,
  };
}

export function requestOnboardingTourStart() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(START_ONBOARDING_TOUR_EVENT));
}

export function OnboardingTour() {
  const startedRef = React.useRef(false);

  const startTour = React.useCallback((force = false) => {
    if (startedRef.current) return;

    const steps = TOUR_STEPS.map(toIntroStep).filter((s): s is Record<string, unknown> => Boolean(s));
    if (!steps.length) return;

    startedRef.current = true;

    const tour = introJs();
    tour.setOptions({
      steps,
      nextLabel: "Next",
      prevLabel: "Back",
      doneLabel: "Done",
      showProgress: true,
      showBullets: true,
      exitOnEsc: true,
      overlayOpacity: 0.4,
      scrollToElement: true,
    });

    tour.oncomplete(() => {
      setTourSeen();
      startedRef.current = false;
    });

    tour.onexit(() => {
      if (!force) {
        setTourSeen();
      }
      startedRef.current = false;
    });

    tour.start();
  }, []);

  React.useEffect(() => {
    const onStartRequest = () => startTour(true);
    window.addEventListener(START_ONBOARDING_TOUR_EVENT, onStartRequest);

    if (!hasSeenTour()) {
      window.setTimeout(() => startTour(false), 500);
    }

    return () => {
      window.removeEventListener(START_ONBOARDING_TOUR_EVENT, onStartRequest);
    };
  }, [startTour]);

  return null;
}
