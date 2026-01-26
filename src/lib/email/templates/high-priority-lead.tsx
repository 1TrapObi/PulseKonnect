import * as React from "react";

export function highPriorityLeadSubject(leadName: string) {
  return `🔴 High Priority Lead: ${leadName}`;
}

export function HighPriorityLeadEmail({
  leadName,
  needType,
  source,
  location,
  email,
  phone,
  href,
}: {
  leadName: string;
  needType?: string | null;
  source?: string | null;
  location?: string | null;
  email?: string | null;
  phone?: string | null;
  href: string;
}) {
  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui", lineHeight: 1.4 }}>
      <h2 style={{ margin: 0 }}>{leadName}</h2>
      <p style={{ marginTop: 8, marginBottom: 8 }}>
        {email ? <span>{email}</span> : null}
        {email && phone ? <span> • </span> : null}
        {phone ? <span>{phone}</span> : null}
      </p>
      <ul style={{ paddingLeft: 18, marginTop: 8 }}>
        <li>Need Type: {needType ?? "—"}</li>
        <li>Location: {location ?? "—"}</li>
        <li>Source: {source ?? "—"}</li>
      </ul>
      <div style={{ marginTop: 16 }}>
        <a
          href={href}
          style={{
            display: "inline-block",
            padding: "10px 14px",
            background: "#EF4444",
            color: "white",
            borderRadius: 8,
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          View Lead Now
        </a>
      </div>
    </div>
  );
}
