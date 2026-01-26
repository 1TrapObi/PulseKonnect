import * as React from "react";

export function reminderDueSubject(reminderType: string, leadName: string) {
  return `Reminder: ${reminderType} for ${leadName}`;
}

export function ReminderDueEmail({
  leadName,
  reminderType,
  dueAt,
  href,
}: {
  leadName: string;
  reminderType: string;
  dueAt: string;
  href: string;
}) {
  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui", lineHeight: 1.4 }}>
      <h2 style={{ margin: 0 }}>Reminder due soon</h2>
      <p style={{ marginTop: 8, marginBottom: 8 }}>
        <strong>{reminderType}</strong> for <strong>{leadName}</strong>
      </p>
      <p style={{ marginTop: 8, marginBottom: 8 }}>Due: {new Date(dueAt).toLocaleString()}</p>
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
