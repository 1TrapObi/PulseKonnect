import { Suspense } from "react";
import { VerifyEmailErrorClient } from "./verify-email-error-client";

export default function VerifyEmailErrorPage() {
  return (
    <Suspense>
      <VerifyEmailErrorClient />
    </Suspense>
  );
}
