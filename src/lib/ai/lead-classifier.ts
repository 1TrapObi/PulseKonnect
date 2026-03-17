import Anthropic from "@anthropic-ai/sdk";

export type LeadPriority = "high" | "medium" | "low";

export type LeadForScoring = {
  name: string;
  age?: number | null;
  location?: string | null;
  city?: string | null;
  zipCode?: string | null;
  diagnosis1?: string | null;
  diagnosis2?: string | null;
  insurance?: string | null;
  services?: string[];
};

export type HistoricalPatternGroup = {
  ageRange: string;
  location: string;
  zipCodes: string[];
  diagnoses: string[];
  insurance: string[];
  conversionRate: number;
  sampleSize: number;
};

export type HistoricalPattern = {
  highValueLeads: HistoricalPatternGroup[];
  sampleSize: number;
  generatedAt: string;
};

export type LeadScoreResult = {
  score: number;
  priority: LeadPriority;
  reasoning: string;
  method: "claude" | "rule_based";
};

export type HistoricalClientRow = {
  age: number | null;
  city: string | null;
  zip_code: string | null;
  diagnosis_code_1: string | null;
  diagnosis_code_2: string | null;
  primary_payer: string | null;
  lead_quality_score: number | null;
};

const DEFAULT_PATTERNS: HistoricalPattern = {
  sampleSize: 3,
  generatedAt: new Date().toISOString(),
  highValueLeads: [
    {
      ageRange: "13-18",
      location: "Durham",
      zipCodes: ["27707", "27701", "27713", "27703", "27704"],
      diagnoses: ["F43.10", "F91.3", "F33.1", "F90.2"],
      insurance: ["Alliance", "AmeriHealth"],
      conversionRate: 0.85,
      sampleSize: 1,
    },
    {
      ageRange: "6-12",
      location: "Durham",
      zipCodes: ["27707", "27701"],
      diagnoses: ["F91.3", "F90.2"],
      insurance: ["Alliance"],
      conversionRate: 0.75,
      sampleSize: 1,
    },
    {
      ageRange: "19-30",
      location: "Raleigh",
      zipCodes: ["27617", "27616", "27610"],
      diagnoses: ["F43.10", "F41.1"],
      insurance: ["Alliance", "Carolina Complete"],
      conversionRate: 0.65,
      sampleSize: 1,
    },
  ],
};

function ageToRange(age: number | null | undefined): string {
  if (age == null || !Number.isFinite(age)) return "unknown";
  if (age >= 6 && age <= 12) return "6-12";
  if (age >= 13 && age <= 18) return "13-18";
  if (age >= 19 && age <= 30) return "19-30";
  return "other";
}

function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 50;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function priorityFromScore(score: number): LeadPriority {
  if (score >= 80) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function cleanCode(code: string | null | undefined): string | null {
  if (!code) return null;
  const text = code.trim().toUpperCase();
  return text.length > 0 ? text : null;
}

export function buildHistoricalPattern(rows: HistoricalClientRow[]): HistoricalPattern {
  const highRows = rows.filter((row) => (row.lead_quality_score ?? 0) >= 80);
  if (highRows.length === 0) return DEFAULT_PATTERNS;

  const groups = new Map<
    string,
    {
      count: number;
      scoreSum: number;
      zipCodes: Set<string>;
      diagnoses: Set<string>;
      insurance: Set<string>;
      location: string;
      ageRange: string;
    }
  >();

  for (const row of highRows) {
    const ageRange = ageToRange(row.age);
    const location = (row.city ?? "Unknown").trim() || "Unknown";
    const key = `${location}|${ageRange}`;

    const current =
      groups.get(key) ??
      {
        count: 0,
        scoreSum: 0,
        zipCodes: new Set<string>(),
        diagnoses: new Set<string>(),
        insurance: new Set<string>(),
        location,
        ageRange,
      };

    current.count += 1;
    current.scoreSum += row.lead_quality_score ?? 0;

    if (row.zip_code) current.zipCodes.add(String(row.zip_code));
    const dx1 = cleanCode(row.diagnosis_code_1);
    const dx2 = cleanCode(row.diagnosis_code_2);
    if (dx1) current.diagnoses.add(dx1);
    if (dx2) current.diagnoses.add(dx2);
    if (row.primary_payer) current.insurance.add(row.primary_payer.trim());

    groups.set(key, current);
  }

  const topGroups = Array.from(groups.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map<HistoricalPatternGroup>((group) => ({
      ageRange: group.ageRange,
      location: group.location,
      zipCodes: Array.from(group.zipCodes).slice(0, 10),
      diagnoses: Array.from(group.diagnoses).slice(0, 10),
      insurance: Array.from(group.insurance).slice(0, 10),
      conversionRate: Number((group.scoreSum / group.count / 100).toFixed(2)),
      sampleSize: group.count,
    }));

  return {
    highValueLeads: topGroups.length > 0 ? topGroups : DEFAULT_PATTERNS.highValueLeads,
    sampleSize: highRows.length,
    generatedAt: new Date().toISOString(),
  };
}

export function scoreLeadSimple(lead: LeadForScoring): LeadScoreResult {
  let score = 50;

  const city = (lead.city ?? lead.location ?? "").toLowerCase();
  if (city.includes("durham")) score += 20;
  else if (city.includes("raleigh") || city.includes("fayetteville")) score += 10;

  const topZips = new Set(["27707", "27701", "27713", "27703", "27704"]);
  if (lead.zipCode && topZips.has(lead.zipCode)) score += 10;

  if (lead.age != null) {
    if (lead.age >= 13 && lead.age <= 18) score += 15;
    else if (lead.age >= 6 && lead.age <= 30) score += 5;
  }

  const insurance = (lead.insurance ?? "").toLowerCase();
  if (insurance.includes("alliance")) score += 10;
  else if (insurance.includes("amerihealth")) score += 5;

  const highDx = new Set(["F43.10", "F91.3", "F33.1"]);
  const dx1 = cleanCode(lead.diagnosis1);
  const dx2 = cleanCode(lead.diagnosis2);
  if ((dx1 && highDx.has(dx1)) || (dx2 && highDx.has(dx2))) score += 10;

  const finalScore = clampScore(score);
  const priority = priorityFromScore(finalScore);

  return {
    score: finalScore,
    priority,
    reasoning: "Rule-based score using geography, zip, age range, insurance, and diagnosis alignment.",
    method: "rule_based",
  };
}

function extractJsonObject(input: string): string | null {
  const start = input.indexOf("{");
  const end = input.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return input.slice(start, end + 1);
}

export async function scoreLeadWithClaude(
  lead: LeadForScoring,
  historicalPatterns: HistoricalPattern
): Promise<LeadScoreResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return scoreLeadSimple(lead);

  const anthropic = new Anthropic({ apiKey });
  const model = process.env.ANTHROPIC_MODEL ?? "claude-3-5-sonnet-latest";

  const prompt = `You are a lead qualification model for a Medicaid-focused mental health provider.

HISTORICAL SUCCESS PATTERNS:\n${JSON.stringify(historicalPatterns, null, 2)}

NEW LEAD:\n${JSON.stringify(lead, null, 2)}

Return only valid JSON with this shape:
{"score": number, "reasoning": string, "priority": "high"|"medium"|"low"}

Scoring rubric:
- high = 80-100
- medium = 40-79
- low = 0-39`;

  const response = await anthropic.messages.create({
    model,
    max_tokens: 700,
    messages: [{ role: "user", content: prompt }],
  });

  const contentBlock = response.content.find(
    (block): block is Extract<(typeof response.content)[number], { type: "text" }> => block.type === "text"
  );
  const text = contentBlock && "text" in contentBlock ? contentBlock.text : "";
  const jsonText = extractJsonObject(text);
  if (!jsonText) return scoreLeadSimple(lead);

  const parsed = JSON.parse(jsonText) as { score?: unknown; reasoning?: unknown; priority?: unknown };
  const score = clampScore(Number(parsed.score));
  const priorityRaw = String(parsed.priority ?? "").toLowerCase();
  const priority: LeadPriority =
    priorityRaw === "high" || priorityRaw === "medium" || priorityRaw === "low"
      ? priorityRaw
      : priorityFromScore(score);

  return {
    score,
    priority,
    reasoning:
      typeof parsed.reasoning === "string" && parsed.reasoning.trim().length > 0
        ? parsed.reasoning.trim()
        : "Claude scoring response returned without reasoning.",
    method: "claude",
  };
}

export async function scoreLead(
  lead: LeadForScoring,
  historicalPatterns: HistoricalPattern
): Promise<LeadScoreResult> {
  try {
    return await scoreLeadWithClaude(lead, historicalPatterns);
  } catch {
    return scoreLeadSimple(lead);
  }
}
