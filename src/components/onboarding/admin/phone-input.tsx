"use client";

import * as React from "react";

function formatPhone(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  const a = digits.slice(0, 3);
  const b = digits.slice(3, 6);
  const c = digits.slice(6, 10);
  if (digits.length <= 3) return a ? `(${a}` : "";
  if (digits.length <= 6) return `(${a}) ${b}`;
  return `(${a}) ${b}-${c}`;
}

export function PhoneInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(formatPhone(e.target.value))}
      className="h-10 w-full rounded-md border px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-900"
      placeholder={placeholder}
      inputMode="tel"
      autoComplete="tel"
    />
  );
}
