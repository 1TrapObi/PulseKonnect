"use client";

import * as React from "react";

export function CheckboxGroup({
  options,
  value,
  onChange,
  columns = 2,
}: {
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  columns?: 1 | 2;
}) {
  function toggle(opt: string) {
    const has = value.includes(opt);
    onChange(has ? value.filter((x) => x !== opt) : [...value, opt]);
  }

  return (
    <div className={"grid gap-2 " + (columns === 2 ? "sm:grid-cols-2" : "grid-cols-1")}>
      {options.map((opt) => (
        <label key={opt} className="flex items-center gap-2 text-sm text-zinc-800">
          <input
            type="checkbox"
            checked={value.includes(opt)}
            onChange={() => toggle(opt)}
            className="h-4 w-4"
          />
          <span>{opt}</span>
        </label>
      ))}
    </div>
  );
}
