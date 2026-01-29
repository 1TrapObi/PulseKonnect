import { z } from "zod";

export const step1Schema = z.object({
  organizationName: z
    .string()
    .min(2, "Organization name must be at least 2 characters")
    .max(200, "Organization name is too long"),
  contactName: z
    .string()
    .min(2, "Contact name must be at least 2 characters")
    .max(100, "Contact name is too long"),
  phone: z.string().regex(/^\(\d{3}\) \d{3}-\d{4}$/, "Invalid phone number format"),
  serviceAreas: z.array(z.string()).min(1, "Please select at least one service area"),
  otherServiceArea: z.string().optional(),
});

export type Step1FormData = z.infer<typeof step1Schema>;

export const step2Schema = z
  .object({
    serviceTypes: z.array(z.string()).min(1, "Please select at least one service type"),
    otherServiceType: z.string().max(100).optional(),
    ageGroups: z.array(z.string()).min(1, "Please select at least one age group"),
    insuranceTypes: z.array(z.string()).min(1, "Please select at least one insurance type"),
    otherInsuranceType: z.string().max(100).optional(),
  })
  .refine(
    (data) => {
      if (data.serviceTypes.includes("Other")) {
        return Boolean(data.otherServiceType && data.otherServiceType.trim().length > 0);
      }
      return true;
    },
    { message: "Please specify the other service type", path: ["otherServiceType"] }
  )
  .refine(
    (data) => {
      if (data.insuranceTypes.includes("Other")) {
        return Boolean(data.otherInsuranceType && data.otherInsuranceType.trim().length > 0);
      }
      return true;
    },
    { message: "Please specify the other insurance type", path: ["otherInsuranceType"] }
  );

export type Step2FormData = z.infer<typeof step2Schema>;

const leadSourceSchema = z.object({
  source: z.string(),
  priority: z.enum(["high", "medium", "low"]).nullable(),
});

export const step3Schema = z.object({
  leadSources: z
    .array(leadSourceSchema)
    .min(1, "Please select at least one lead source")
    .refine((sources) => sources.some((s) => s.priority !== null), {
      message: "Please set priority for at least one lead source",
    }),
  volumeGoal: z.enum(["low", "medium", "high", "very_high"], {
    message: "Please select a lead volume goal",
  }),
  assignmentMethod: z.enum(["manual", "round_robin", "geographic", "specialization"], {
    message: "Please select an assignment method",
  }),
  emailHighPriority: z.boolean().default(true),
  dailyDigest: z.boolean().default(false),
  weeklyReport: z.boolean().default(true),
});

export type Step3FormData = z.infer<typeof step3Schema>;

const positionSchema = z
  .object({
    title: z.string().min(2, "Position title is required").max(200),
    requiredLicenses: z.array(z.string()).min(1, "Please select at least one required license"),
    experienceLevel: z.enum(["entry", "mid", "senior"], {
      message: "Please select experience level",
    }),
    employmentType: z.enum(["full_time", "part_time", "contract", "per_diem"], {
      message: "Please select employment type",
    }),
    specializations: z.array(z.string()).optional(),
    salaryMin: z.number().positive().optional(),
    salaryMax: z.number().positive().optional(),
  })
  .refine(
    (data) => {
      if (data.salaryMin != null && data.salaryMax != null) {
        return data.salaryMin < data.salaryMax;
      }
      return true;
    },
    { message: "Minimum salary must be less than maximum salary", path: ["salaryMax"] }
  );

export const step4Schema = z
  .object({
    skipPositions: z.boolean().default(false),
    positions: z.array(positionSchema).optional(),
    candidateSources: z.array(z.string()).min(1, "Please select at least one candidate source"),
    hiringVolume: z.string().min(1, "Please select expected hiring volume"),
  })
  .refine(
    (data) => {
      if (!data.skipPositions) {
        return Boolean(data.positions && data.positions.length > 0);
      }
      return true;
    },
    { message: "Please add at least one position or skip this section", path: ["positions"] }
  );

export type Step4FormData = z.infer<typeof step4Schema>;

const teamInvitationSchema = z.object({
  email: z.string().email("Invalid email address").max(255),
  role: z.enum(["admin", "staff", "viewer"], { message: "Please select a role" }),
});

export const step5Schema = z
  .object({
    hasPostAccount: z.boolean().default(false),
    postApiKey: z.string().max(255).optional(),
    emailNotifications: z.object({
      highPriorityLeads: z.boolean().default(true),
      newCandidates: z.boolean().default(true),
      weeklySummary: z.boolean().default(false),
      systemUpdates: z.boolean().default(false),
    }),
    teamInvitations: z.array(teamInvitationSchema).optional(),
  })
  .refine(
    (data) => {
      if (data.hasPostAccount && !data.postApiKey) return false;
      return true;
    },
    {
      message: 'Please provide Post API key or uncheck "I have a Post account"',
      path: ["postApiKey"],
    }
  )
  .refine(
    (data) => {
      if (data.teamInvitations?.length) {
        const emails = data.teamInvitations.map((inv) => inv.email.toLowerCase());
        return emails.length === new Set(emails).size;
      }
      return true;
    },
    { message: "Duplicate email addresses are not allowed", path: ["teamInvitations"] }
  )
  .refine(
    (data) => {
      if (!data.teamInvitations?.length) return true;
      return data.teamInvitations.some((i) => i.role === "admin" || i.role === "staff");
    },
    { message: "Please invite at least one Admin or Staff (or remove invites)", path: ["teamInvitations"] }
  );

export type Step5FormData = z.infer<typeof step5Schema>;
