"use client";

import * as React from "react";

const areas = [
  "Durham County, NC",
  "Wake County, NC",
  "Orange County, NC",
  "Wayne County, NC",
  "Guilford County, NC",
  "Alamance County, NC",
];

export function ServiceAreasCheckboxes({
  value,
  onChange,
  otherChecked,
  onOtherCheckedChange,
  otherValue,
  onOtherValueChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  otherChecked: boolean;
  onOtherCheckedChange: (v: boolean) => void;
  otherValue: string;
  onOtherValueChange: (v: string) => void;
}) {
  function toggleArea(area: string) {
    const has = value.includes(area);
    const next = has ? value.filter((x) => x !== area) : [...value, area];
    onChange(next);
  }

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        {areas.map((a) => (
          <label key={a} className="flex items-center gap-2 text-sm text-zinc-800">
            <input
              type="checkbox"
              checked={value.includes(a)}
              onChange={() => toggleArea(a)}
              className="h-4 w-4"
            />
            <span>{a}</span>
          </label>
        ))}

        <label className="flex items-center gap-2 text-sm text-zinc-800">
          <input
            type="checkbox"
            checked={otherChecked}
            onChange={(e) => onOtherCheckedChange(e.target.checked)}
            className="h-4 w-4"
          />
          <span>Other</span>
        </label>
      </div>

      {otherChecked ? (
        <input
          value={otherValue}
          onChange={(e) => onOtherValueChange(e.target.value)}
          placeholder="Enter your service area"
          className="h-10 w-full rounded-md border px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-900"
        />
      ) : null}
    </div>
  );
}
