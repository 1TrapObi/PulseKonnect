import type * as React from "react";

import { getResendClient } from "@/lib/email/client";

function getFromEmail() {
  return process.env.RESEND_FROM_EMAIL ?? "Pulse Konnect <no-reply@pulsekonnect.com>";
}

export async function sendEmail({
  to,
  subject,
  react,
}: {
  to: string;
  subject: string;
  react: React.ReactElement;
}) {
  const resend = getResendClient();

  return resend.emails.send({
    from: getFromEmail(),
    to,
    subject,
    react,
  });
}
