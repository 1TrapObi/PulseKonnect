export type CandidateForMatch = {
  id: string;
  license_type: string | null;
  experience_level?: string | null;
  experience_years?: number | null;
  specializations?: string[] | null;
  location?: string | null;
};

export type PositionForMatch = {
  id: string;
  required_licenses: string[];
  experience_level: string;
  required_specializations?: string[] | null;
  preferred_specializations?: string[] | null;
  work_locations: string[];
};

function norm(s: string) {
  return s.trim().toLowerCase();
}

function asArray(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean);
  return [];
}

function expLevelFromYears(years: number | null | undefined): string | null {
  if (typeof years !== "number" || Number.isNaN(years)) return null;
  if (years < 2) return "entry";
  if (years < 5) return "mid";
  return "senior";
}

function expScore(candidateLevel: string | null, required: string): number {
  const req = norm(required);
  if (req === "any") return 20;

  const c = candidateLevel ? norm(candidateLevel) : null;
  if (!c) return 0;
  if (c === req) return 20;

  const order = ["entry", "mid", "senior"];
  const ci = order.indexOf(c);
  const ri = order.indexOf(req);
  if (ci === -1 || ri === -1) return 0;
  return Math.abs(ci - ri) === 1 ? 10 : 0;
}

function overlapCount(a: string[], b: string[]) {
  if (!a.length || !b.length) return 0;
  const set = new Set(b.map(norm));
  let c = 0;
  for (const x of a) {
    if (set.has(norm(x))) c += 1;
  }
  return c;
}

function locationScore(candidateLocation: string | null | undefined, workLocations: string[]): number {
  if (!candidateLocation) return 0;
  const c = norm(candidateLocation);
  const locs = workLocations.map(norm);
  if (locs.some((l) => l && (c.includes(l) || l.includes(c)))) return 10;
  return 0;
}

export function calculatePositionMatch(candidate: CandidateForMatch, position: PositionForMatch): number {
  const requiredLicenses = asArray((position as any).required_licenses);
  const candLicense = candidate.license_type ? norm(candidate.license_type) : "";
  const licenseOk = requiredLicenses.map(norm).includes(candLicense);
  if (!licenseOk) return 0;

  let score = 50;

  const inferredLevel = candidate.experience_level
    ? String(candidate.experience_level)
    : expLevelFromYears(candidate.experience_years ?? null);

  score += expScore(inferredLevel, position.experience_level);

  const candSpecs = asArray(candidate.specializations);
  const reqSpecs = asArray((position as any).required_specializations);
  const prefSpecs = asArray((position as any).preferred_specializations);

  if (reqSpecs.length) {
    const matches = overlapCount(candSpecs, reqSpecs);
    score += Math.round((matches / reqSpecs.length) * 20);
  }

  if (prefSpecs.length) {
    const matches = overlapCount(candSpecs, prefSpecs);
    score += Math.min(matches * 5, 10);
  }

  score += locationScore(candidate.location ?? null, asArray((position as any).work_locations));

  if (score < 0) score = 0;
  if (score > 100) score = 100;
  return Math.round(score);
}

export function buildCandidatePositionMatchUpserts(
  candidates: CandidateForMatch[],
  position: PositionForMatch
): Array<{ candidate_id: string; position_id: string; match_score: number; match_reasons: any }> {
  const upserts: Array<{ candidate_id: string; position_id: string; match_score: number; match_reasons: any }> = [];
  for (const c of candidates) {
    const score = calculatePositionMatch(c, position);
    if (score <= 0) continue;
    upserts.push({
      candidate_id: c.id,
      position_id: position.id,
      match_score: score,
      match_reasons: null,
    });
  }
  return upserts;
}
