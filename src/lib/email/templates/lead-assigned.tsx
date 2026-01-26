import * as React from "react";

export function leadAssignedSubject() {
  return "New Lead Assigned to You";
}

export function LeadAssignedEmail({
  leadName,
  needType,
  source,
  location,
  assignedBy,
  href,
}: {
  leadName: string;
  needType?: string | null;
  source?: string | null;
  location?: string | null;
  assignedBy?: string | null;
  href: string;
}) {
  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui", lineHeight: 1.4 }}>
      <h2 style={{ margin: 0 }}>New lead assigned</h2>
      <p style={{ marginTop: 8, marginBottom: 8 }}>
        <strong>{leadName}</strong>
      </p>
      <ul style={{ paddingLeft: 18, marginTop: 8 }}>
        <li>Need Type: {needType ?? "—"}</li>
        <li>Location: {location ?? "—"}</li>
        <li>Source: {source ?? "—"}</li>
        <li>Assigned by: {assignedBy ?? "—"}</li>
      </ul>
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
