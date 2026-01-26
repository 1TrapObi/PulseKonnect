export const CANDIDATE_STATUS_ORDER = ["new", "screening", "interview", "offer", "hired"] as const;
export const CANDIDATE_FINAL_STATUSES = new Set(["hired", "rejected"]);

export function normalizeCandidateStatus(s: string) {
  return s.trim().toLowerCase();
}

export function isValidCandidateTransition(from: string, to: string) {
  const f = normalizeCandidateStatus(from);
  const t = normalizeCandidateStatus(to);

  if (f === t) return true;
  if (CANDIDATE_FINAL_STATUSES.has(f)) return false;
  if (t === "rejected") return f !== "hired";

  const fromIdx = CANDIDATE_STATUS_ORDER.indexOf(f as any);
  const toIdx = CANDIDATE_STATUS_ORDER.indexOf(t as any);
  if (fromIdx === -1 || toIdx === -1) return false;
  return toIdx === fromIdx + 1;
}
