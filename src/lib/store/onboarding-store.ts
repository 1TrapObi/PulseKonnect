import { create } from "zustand";

export type OrganizationProfile = {
  name: string;
  contactName: string;
  phone: string;
  serviceAreas: string[];
  otherServiceArea?: string;
};

export type ServicesProfile = {
  serviceTypes: string[];
  otherServiceType?: string;
  ageGroups: string[];
  insuranceTypes: string[];
  otherInsuranceType?: string;
};

export type LeadSourcePriority = "high" | "medium" | "low";

export type LeadSource = {
  source: string;
  priority: LeadSourcePriority | null;
};

export type LeadGenPreferences = {
  leadSources: LeadSource[];
  volumeGoal: "low" | "medium" | "high" | "very_high";
  assignmentMethod: "manual" | "round_robin" | "geographic" | "specialization";
  emailHighPriority: boolean;
  dailyDigest: boolean;
  weeklyReport: boolean;
};

export type Position = {
  title: string;
  requiredLicenses: string[];
  experienceLevel: "entry" | "mid" | "senior";
  employmentType: "full_time" | "part_time" | "contract" | "per_diem";
  specializations: string[];
  salaryMin?: number;
  salaryMax?: number;
};

export type RecruitmentPreferences = {
  skipPositions: boolean;
  positions: Position[];
  candidateSources: string[];
  hiringVolume: string;
};

export type TeamInvitation = {
  email: string;
  role: "admin" | "staff" | "viewer";
};

export type IntegrationsSetup = {
  hasPostAccount: boolean;
  postApiKey?: string;
  postConnected: boolean;
  emailNotifications: {
    highPriorityLeads: boolean;
    newCandidates: boolean;
    weeklySummary: boolean;
    systemUpdates: boolean;
  };
  teamInvitations: TeamInvitation[];
};

type OnboardingState = {
  currentStep: number;
  organizationProfile: OrganizationProfile;
  servicesProfile: ServicesProfile;
  leadGenPreferences: LeadGenPreferences;
  recruitmentPreferences: RecruitmentPreferences;
  integrationsSetup: IntegrationsSetup;
  setCurrentStep: (step: number) => void;
  setOrganizationProfile: (data: Partial<OrganizationProfile>) => void;
  setServicesProfile: (data: Partial<ServicesProfile>) => void;
  setLeadGenPreferences: (data: Partial<LeadGenPreferences>) => void;
  setRecruitmentPreferences: (data: Partial<RecruitmentPreferences>) => void;
  setIntegrationsSetup: (data: Partial<IntegrationsSetup>) => void;
  nextStep: () => void;
  prevStep: () => void;
  resetOnboarding: () => void;
};

export const useOnboardingStore = create<OnboardingState>((set) => ({
  currentStep: 1,
  organizationProfile: {
    name: "",
    contactName: "",
    phone: "",
    serviceAreas: [],
    otherServiceArea: "",
  },
  servicesProfile: {
    serviceTypes: [],
    otherServiceType: "",
    ageGroups: [],
    insuranceTypes: [],
    otherInsuranceType: "",
  },
  leadGenPreferences: {
    leadSources: [],
    volumeGoal: "medium",
    assignmentMethod: "manual",
    emailHighPriority: true,
    dailyDigest: false,
    weeklyReport: true,
  },
  recruitmentPreferences: {
    skipPositions: false,
    positions: [],
    candidateSources: [],
    hiringVolume: "",
  },
  integrationsSetup: {
    hasPostAccount: false,
    postApiKey: "",
    postConnected: false,
    emailNotifications: {
      highPriorityLeads: true,
      newCandidates: true,
      weeklySummary: false,
      systemUpdates: false,
    },
    teamInvitations: [],
  },
  setCurrentStep: (step) => set({ currentStep: step }),
  setOrganizationProfile: (data) =>
    set((s) => ({
      organizationProfile: {
        ...s.organizationProfile,
        ...data,
      },
    })),
  setServicesProfile: (data) =>
    set((s) => ({
      servicesProfile: {
        ...s.servicesProfile,
        ...data,
      },
    })),
  setLeadGenPreferences: (data) =>
    set((s) => ({
      leadGenPreferences: {
        ...s.leadGenPreferences,
        ...data,
      },
    })),
  setRecruitmentPreferences: (data) =>
    set((s) => ({
      recruitmentPreferences: {
        ...s.recruitmentPreferences,
        ...data,
      },
    })),
  setIntegrationsSetup: (data) =>
    set((s) => ({
      integrationsSetup: {
        ...s.integrationsSetup,
        ...data,
        emailNotifications: {
          ...s.integrationsSetup.emailNotifications,
          ...(data as any).emailNotifications,
        },
      },
    })),
  nextStep: () => set((s) => ({ currentStep: Math.min(5, s.currentStep + 1) })),
  prevStep: () => set((s) => ({ currentStep: Math.max(1, s.currentStep - 1) })),
  resetOnboarding: () =>
    set({
      currentStep: 1,
      organizationProfile: {
        name: "",
        contactName: "",
        phone: "",
        serviceAreas: [],
        otherServiceArea: "",
      },
      servicesProfile: {
        serviceTypes: [],
        otherServiceType: "",
        ageGroups: [],
        insuranceTypes: [],
        otherInsuranceType: "",
      },
      leadGenPreferences: {
        leadSources: [],
        volumeGoal: "medium",
        assignmentMethod: "manual",
        emailHighPriority: true,
        dailyDigest: false,
        weeklyReport: true,
      },
      recruitmentPreferences: {
        skipPositions: false,
        positions: [],
        candidateSources: [],
        hiringVolume: "",
      },
      integrationsSetup: {
        hasPostAccount: false,
        postApiKey: "",
        postConnected: false,
        emailNotifications: {
          highPriorityLeads: true,
          newCandidates: true,
          weeklySummary: false,
          systemUpdates: false,
        },
        teamInvitations: [],
      },
    }),
}));
