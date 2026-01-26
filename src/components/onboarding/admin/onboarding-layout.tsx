import Image from "next/image";
import { type ReactNode } from "react";

import { BackToLoginButton } from "@/components/onboarding/admin/back-to-login-button";
import { ProgressBar } from "@/components/onboarding/admin/progress-bar";

export function OnboardingLayout({
  currentStep,
  children,
}: {
  currentStep: number;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto flex min-h-screen max-w-2xl items-start px-4 py-8 sm:px-6">
        <div className="w-full space-y-4">
          <div className="flex items-center justify-between gap-3 py-2">
            <div />
            <Image
              src="/pulsekonnect-logo.svg"
              alt="Pulse Konnect"
              width={220}
              height={64}
              className="h-auto w-[220px]"
              priority
            />
            <BackToLoginButton className="shrink-0" />
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <ProgressBar currentStep={currentStep} />
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
