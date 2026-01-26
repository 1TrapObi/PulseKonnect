export const LEAD_SOURCES = [
  "Court-Mandated Referrals",
  "Hospital Discharge Programs",
  "Treatment Facility Referrals",
  "Community Organizations",
  "SAMHSA Treatment Locator",
  "Direct Website Inquiries",
  "Social Media Outreach",
  "Insurance Provider Networks",
] as const;

export const VOLUME_GOALS = [
  { value: "low", label: "Low volume (1-10 leads/week)" },
  { value: "medium", label: "Medium volume (10-25 leads/week)" },
  { value: "high", label: "High volume (25-50 leads/week)" },
  { value: "very_high", label: "Very high volume (50+ leads/week)" },
] as const;

export const ASSIGNMENT_METHODS = [
  { value: "manual", label: "Manual assignment", description: "Admins assign leads to staff" },
  { value: "round_robin", label: "Round-robin", description: "Auto-distribute equally among staff" },
  { value: "geographic", label: "Geographic", description: "Assign based on staff location preferences" },
  { value: "specialization", label: "Specialization match", description: "Assign based on staff specializations" },
] as const;

export const PRIORITY_OPTIONS = [
  { value: "", label: "--" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
] as const;

export const CANDIDATE_SOURCES = [
  "Indeed",
  "LinkedIn",
  "Professional Networks (NASW, ACA, NAADAC)",
  "University Career Services",
  "State Licensing Boards",
  "Employee Referrals",
  "Social Media (Professional)",
] as const;

export const HIRING_VOLUMES = [
  "1 person",
  "2-5 people",
  "6-10 people",
  "11-20 people",
  "20+ people",
  "Not sure yet",
] as const;

export const LICENSE_TYPES = ["LCSW", "LPC", "LCAS", "LMSW", "No License Required"] as const;

export const EXPERIENCE_LEVELS = [
  { value: "entry", label: "Entry (0-2 yrs)" },
  { value: "mid", label: "Mid (2-5 yrs)" },
  { value: "senior", label: "Senior (5+ yrs)" },
] as const;

export const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "per_diem", label: "Per Diem" },
] as const;

export const POSITION_SPECIALIZATIONS = [
  "Substance Abuse",
  "Mental Health",
  "Trauma",
  "Crisis",
  "Family Therapy",
  "Adolescent Services",
] as const;
