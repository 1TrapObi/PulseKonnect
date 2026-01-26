import * as React from "react";

export function teamInvitationSubject(organizationName: string) {
  return `You\u2019ve been invited to join ${organizationName} on Pulse Konnect`;
}

export function TeamInvitationEmail({
  inviterName,
  organizationName,
  invitationLink,
  role,
}: {
  inviterName: string;
  organizationName: string;
  invitationLink: string;
  role: "admin" | "staff" | "viewer";
}) {
  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui", lineHeight: 1.4 }}>
      <h2 style={{ margin: 0 }}>You\u2019re invited to join {organizationName}</h2>
      <p style={{ marginTop: 8, marginBottom: 8 }}>Hi there,</p>
      <p style={{ marginTop: 8, marginBottom: 8 }}>
        <strong>{inviterName}</strong> has invited you to join their team on Pulse Konnect as a{" "}
        <strong>{role}</strong>.
      </p>
      <p style={{ marginTop: 8, marginBottom: 8 }}>
        Click the button below to accept the invitation and create your account.
      </p>
      <div style={{ marginTop: 16 }}>
        <a
          href={invitationLink}
          style={{
            display: "inline-block",
            padding: "10px 14px",
            background: "#111827",
            color: "white",
            borderRadius: 8,
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Accept Invitation
        </a>
      </div>
      <p style={{ marginTop: 16, marginBottom: 0, color: "#52525b" }}>
        This invitation expires in 7 days. If you weren\u2019t expecting this email, you can safely ignore it.
      </p>
    </div>
  );
}
