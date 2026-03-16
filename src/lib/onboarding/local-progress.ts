export const TOUR_SEEN_KEY = "pk_has_seen_onboarding_tour";
export const CHECKLIST_DISMISSED_KEY = "pk_onboarding_checklist_dismissed";

export const CHECKLIST_KEYS = {
  firstLead: "pk_onboarding_first_lead",
  statusUpdated: "pk_onboarding_status_updated",
  assignedLead: "pk_onboarding_assigned_lead",
  addedNote: "pk_onboarding_added_note",
} as const;

export type ChecklistItemKey = keyof typeof CHECKLIST_KEYS;

export type ChecklistProgress = {
  firstLead: boolean;
  statusUpdated: boolean;
  assignedLead: boolean;
  addedNote: boolean;
};

function isBrowser() {
  return typeof window !== "undefined";
}

export function markChecklistProgress(item: ChecklistItemKey) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(CHECKLIST_KEYS[item], "1");
    window.dispatchEvent(new CustomEvent("pk:onboarding-progress-updated"));
  } catch {
    return;
  }
}

export function getChecklistProgress(): ChecklistProgress {
  if (!isBrowser()) {
    return {
      firstLead: false,
      statusUpdated: false,
      assignedLead: false,
      addedNote: false,
    };
  }

  try {
    return {
      firstLead: window.localStorage.getItem(CHECKLIST_KEYS.firstLead) === "1",
      statusUpdated: window.localStorage.getItem(CHECKLIST_KEYS.statusUpdated) === "1",
      assignedLead: window.localStorage.getItem(CHECKLIST_KEYS.assignedLead) === "1",
      addedNote: window.localStorage.getItem(CHECKLIST_KEYS.addedNote) === "1",
    };
  } catch {
    return {
      firstLead: false,
      statusUpdated: false,
      assignedLead: false,
      addedNote: false,
    };
  }
}

export function setChecklistDismissed(value: boolean) {
  if (!isBrowser()) return;
  try {
    if (value) {
      window.localStorage.setItem(CHECKLIST_DISMISSED_KEY, "1");
    } else {
      window.localStorage.removeItem(CHECKLIST_DISMISSED_KEY);
    }
    window.dispatchEvent(new CustomEvent("pk:onboarding-progress-updated"));
  } catch {
    return;
  }
}

export function isChecklistDismissed() {
  if (!isBrowser()) return false;
  try {
    return window.localStorage.getItem(CHECKLIST_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function setTourSeen() {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(TOUR_SEEN_KEY, "1");
  } catch {
    return;
  }
}

export function hasSeenTour() {
  if (!isBrowser()) return true;
  try {
    return window.localStorage.getItem(TOUR_SEEN_KEY) === "1";
  } catch {
    return true;
  }
}
