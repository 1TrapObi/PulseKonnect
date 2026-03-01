import * as React from "react";

export function referralSubmittedSubject(leadName: string) {
  return `New Referral: ${leadName}`;
}

export function ReferralSubmittedEmail({
  organizationName,
  leadName,
  phone,
  email,
  needType,
  urgency,
  location,
  insuranceType,
  medicaidNumber,
  referralAgency,
  referralContactName,
  referralContactEmail,
  notes,
  href,
}: {
  organizationName: string;
  leadName: string;
  phone: string;
  email?: string | null;
  needType?: string | null;
  urgency?: string | null;
  location?: string | null;
  insuranceType?: string | null;
  medicaidNumber?: string | null;
  referralAgency?: string | null;
  referralContactName?: string | null;
  referralContactEmail?: string | null;
  notes?: string | null;
  href: string;
}) {
  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui", lineHeight: 1.4 }}>
      <h2 style={{ margin: 0 }}>New referral submitted</h2>
      <p style={{ marginTop: 8, marginBottom: 8 }}>
        Organization: <strong>{organizationName}</strong>
      </p>

      <div style={{ marginTop: 16 }}>
        <h3 style={{ marginBottom: 8 }}>Client</h3>
        <ul style={{ paddingLeft: 18, marginTop: 0 }}>
          <li>Name: {leadName}</li>
          <li>Phone: {phone}</li>
          <li>Email: {email ?? "—"}</li>
          <li>Location: {location ?? "—"}</li>
        </ul>
      </div>

      <div style={{ marginTop: 16 }}>
        <h3 style={{ marginBottom: 8 }}>Service</h3>
        <ul style={{ paddingLeft: 18, marginTop: 0 }}>
          <li>Need Type: {needType ?? "—"}</li>
          <li>Urgency: {urgency ?? "—"}</li>
          <li>Insurance: {insuranceType ?? "—"}</li>
          <li>Medicaid #: {medicaidNumber ?? "—"}</li>
        </ul>
      </div>

      <div style={{ marginTop: 16 }}>
        <h3 style={{ marginBottom: 8 }}>Referral Source</h3>
        <ul style={{ paddingLeft: 18, marginTop: 0 }}>
          <li>Agency: {referralAgency ?? "—"}</li>
          <li>Contact Name: {referralContactName ?? "—"}</li>
          <li>Contact Email: {referralContactEmail ?? "—"}</li>
        </ul>
      </div>

      {notes ? (
        <div style={{ marginTop: 16 }}>
          <h3 style={{ marginBottom: 8 }}>Notes</h3>
          <p style={{ marginTop: 0 }}>{notes}</p>
        </div>
      ) : null}

      <div style={{ marginTop: 16 }}>
        <a
          href={href}
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
          View Lead
        </a>
      </div>
    </div>
  );
}
