"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { LICENSE_TYPES, POSITION_SPECIALIZATIONS } from "@/lib/constants/onboarding";

export function PositionCard({
  index,
  value,
  onRemove,
  onChange,
  error,
}: {
  index: number;
  value: {
    title: string;
    requiredLicenses: string[];
    experienceLevel: "entry" | "mid" | "senior";
    employmentType: "full_time" | "part_time" | "contract" | "per_diem";
    specializations: string[];
    salaryMin?: number;
    salaryMax?: number;
  };
  onRemove?: () => void;
  onChange: (next: any) => void;
  error?: any;
}) {
  const toggleArrayValue = (arr: string[], v: string, checked: boolean) => {
    const set = new Set(arr || []);
    if (checked) set.add(v);
    else set.delete(v);
    return Array.from(set);
  };

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-zinc-900">Position {index + 1}</div>
        {onRemove ? (
          <button type="button" onClick={onRemove} className="text-sm text-zinc-600 hover:text-zinc-900">
            Remove
          </button>
        ) : null}
      </div>

      <div className="mt-3 space-y-4">
        <div>
          <div className="text-sm font-medium">Position Title *</div>
          <Input
            value={value.title}
            onChange={(e) => onChange({ ...value, title: e.target.value })}
            placeholder="Mental Health Counselor"
          />
          {error?.title ? <div className="mt-1 text-xs text-red-600">{error.title.message}</div> : null}
        </div>

        <div>
          <div className="text-sm font-medium">Required License *</div>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {LICENSE_TYPES.map((lt) => (
              <label key={lt} className="flex items-center gap-2 text-sm text-zinc-800">
                <input
                  type="checkbox"
                  checked={(value.requiredLicenses || []).includes(lt)}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      requiredLicenses: toggleArrayValue(value.requiredLicenses || [], lt, e.target.checked),
                    })
                  }
                  className="h-4 w-4"
                />
                <span>{lt}</span>
              </label>
            ))}
          </div>
          {error?.requiredLicenses ? (
            <div className="mt-1 text-xs text-red-600">{error.requiredLicenses.message}</div>
          ) : null}
        </div>

        <div>
          <div className="text-sm font-medium">Experience Level *</div>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:gap-4">
            {([
              { value: "entry", label: "Entry (0-2 yrs)" },
              { value: "mid", label: "Mid (2-5 yrs)" },
              { value: "senior", label: "Senior (5+)" },
            ] as const).map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 text-sm text-zinc-800">
                <input
                  type="radio"
                  name={`experience-${index}`}
                  checked={value.experienceLevel === opt.value}
                  onChange={() => onChange({ ...value, experienceLevel: opt.value })}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
          {error?.experienceLevel ? (
            <div className="mt-1 text-xs text-red-600">{error.experienceLevel.message}</div>
          ) : null}
        </div>

        <div>
          <div className="text-sm font-medium">Employment Type *</div>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-4">
            {([
              { value: "full_time", label: "Full-time" },
              { value: "part_time", label: "Part-time" },
              { value: "contract", label: "Contract" },
              { value: "per_diem", label: "Per Diem" },
            ] as const).map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 text-sm text-zinc-800">
                <input
                  type="radio"
                  name={`employment-${index}`}
                  checked={value.employmentType === opt.value}
                  onChange={() => onChange({ ...value, employmentType: opt.value })}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
          {error?.employmentType ? (
            <div className="mt-1 text-xs text-red-600">{error.employmentType.message}</div>
          ) : null}
        </div>

        <div>
          <div className="text-sm font-medium">Specializations (optional)</div>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {POSITION_SPECIALIZATIONS.map((s) => (
              <label key={s} className="flex items-center gap-2 text-sm text-zinc-800">
                <input
                  type="checkbox"
                  checked={(value.specializations || []).includes(s)}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      specializations: toggleArrayValue(value.specializations || [], s, e.target.checked),
                    })
                  }
                  className="h-4 w-4"
                />
                <span>{s}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <div className="text-sm font-medium">Salary Range (optional)</div>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <div className="text-xs text-zinc-600">Min</div>
              <Input
                type="number"
                value={value.salaryMin ?? ""}
                onChange={(e) =>
                  onChange({
                    ...value,
                    salaryMin: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                placeholder="50000"
              />
            </div>
            <div>
              <div className="text-xs text-zinc-600">Max</div>
              <Input
                type="number"
                value={value.salaryMax ?? ""}
                onChange={(e) =>
                  onChange({
                    ...value,
                    salaryMax: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                placeholder="65000"
              />
              {error?.salaryMax ? <div className="mt-1 text-xs text-red-600">{error.salaryMax.message}</div> : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
