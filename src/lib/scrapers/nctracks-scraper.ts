import puppeteer, { Browser, Page } from "puppeteer";
import { randomUUID } from "node:crypto";

import {
  buildHistoricalPattern,
  type HistoricalClientRow,
  scoreLead,
  type LeadForScoring,
} from "@/lib/ai/lead-classifier";
import { createSupabaseAdminClient } from "@/lib/db/supabase/server";

export type ScraperFilters = {
  counties: string[];
  zipCodes?: string[];
  serviceTypes: string[];
  insuranceProviders: string[];
};

export type ScraperConfig = {
  organizationId: string;
  filters: ScraperFilters;
  keywords: string[];
  targetVolume: number;
};

export type ScrapedLead = {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  city: string;
  zipCode: string;
  services: string[];
  insuranceAccepted: string[];
  sourceUrl: string;
  metadata: Record<string, unknown>;
};

export type ScraperResult = {
  runId: string;
  status: "completed" | "failed";
  leadsFound: number;
  leadsImported: number;
  executionTimeMs: number;
  errorMessage?: string;
};

type ScraperRunRow = { id: string };
type LeadIdRow = { id: string };
type ClientPatternRow = HistoricalClientRow;
type ScraperRunContext = { id: string; persisted: boolean };

function messageFromError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function normalizeStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.map((item) => String(item).trim()).filter(Boolean);
}

export class NCTracksScraper {
  private browser: Browser | null = null;

  private getAdminClient() {
    return createSupabaseAdminClient();
  }

  private async initBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
    }

    return this.browser;
  }

  private async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async run(config: ScraperConfig): Promise<ScraperResult> {
    const startTime = Date.now();
    const admin = this.getAdminClient();

    const runContext = await this.createScraperRun(config);
    const runId = runContext.id;

    try {
      const browser = await this.initBrowser();
      const page = await browser.newPage();

      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
      );

      const ncTracksUrl =
        process.env.NCTRACKS_URL ?? "https://nctracks.nc.gov/content/public/providers/provider-search.html";

      console.log(`[NCTracks Scraper] Navigating to ${ncTracksUrl}...`);

      const scrapedLeads = await this.scrapeProviders(page, config);
      const importedCount = await this.importLeads(scrapedLeads, config.organizationId);

      const executionTime = Date.now() - startTime;

      if (runContext.persisted) {
        await admin
          .from("scraper_runs")
          .update({
            status: "completed",
            leads_found: scrapedLeads.length,
            leads_imported: importedCount,
            execution_time_ms: executionTime,
            completed_at: new Date().toISOString(),
          })
          .eq("id", runId);
      }

      await admin
        .from("scraper_config")
        .update({ last_run_at: new Date().toISOString() })
        .eq("organization_id", config.organizationId)
        .eq("scraper_type", "nctracks");

      await this.closeBrowser();

      return {
        runId,
        status: "completed",
        leadsFound: scrapedLeads.length,
        leadsImported: importedCount,
        executionTimeMs: executionTime,
      };
    } catch (error: unknown) {
      const errorMessage = messageFromError(error);

      if (runContext.persisted) {
        await admin
          .from("scraper_runs")
          .update({
            status: "failed",
            error_message: errorMessage,
            completed_at: new Date().toISOString(),
          })
          .eq("id", runId);
      }

      await this.closeBrowser();

      return {
        runId,
        status: "failed",
        leadsFound: 0,
        leadsImported: 0,
        executionTimeMs: Date.now() - startTime,
        errorMessage,
      };
    }
  }

  private async createScraperRun(config: ScraperConfig): Promise<ScraperRunContext> {
    const admin = this.getAdminClient();
    const baseInsert = {
      organization_id: config.organizationId,
      scraper_type: "nctracks",
      status: "running",
    };

    const { data: withConfigData, error: withConfigError } = await admin
      .from("scraper_runs")
      .insert({ ...baseInsert, config })
      .select("id")
      .single();

    if (!withConfigError && withConfigData) {
      return { id: (withConfigData as ScraperRunRow).id, persisted: true };
    }

    const message = withConfigError?.message?.toLowerCase() ?? "";
    const missingConfigColumn =
      message.includes("column") && message.includes("config") && message.includes("scraper_runs");

    if (!missingConfigColumn) {
      const messageUnknown = withConfigError?.message ?? "unknown error";
      console.warn(`[NCTracks Scraper] scraper_runs insert failed; continuing without run persistence: ${messageUnknown}`);
      return { id: randomUUID(), persisted: false };
    }

    console.warn("[NCTracks Scraper] scraper_runs.config missing; retrying without config column.");

    const { data: fallbackData, error: fallbackError } = await admin
      .from("scraper_runs")
      .insert(baseInsert)
      .select("id")
      .single();

    if (fallbackError || !fallbackData) {
      const messageUnknown = fallbackError?.message ?? "unknown error";
      console.warn(
        `[NCTracks Scraper] scraper_runs fallback insert failed; continuing without run persistence: ${messageUnknown}`
      );
      return { id: randomUUID(), persisted: false };
    }

    return { id: (fallbackData as ScraperRunRow).id, persisted: true };
  }

  private async performLogin(page: Page, credentials: { username: string; password: string }): Promise<void> {
    void page;
    void credentials;
    console.log("[NCTracks Scraper] Login flow not implemented yet. Waiting on NCTracks credentials.");
  }

  private async applyFilters(page: Page, filters: ScraperFilters): Promise<void> {
    void page;
    console.log("[NCTracks Scraper] Applying filters:", filters);
  }

  private async scrapeProviders(page: Page, config: ScraperConfig): Promise<ScrapedLead[]> {
    void page;
    void config;

    console.log("[NCTracks Scraper] Using mock data (Phase 1 architecture mode)");

    return [
      {
        name: "Durham Mental Health Services",
        phone: "(919) 555-0101",
        email: "contact@durhammental.org",
        address: "123 Main St",
        city: "Durham",
        zipCode: "27707",
        services: ["Mental Health", "PTSD Treatment", "Substance Abuse"],
        insuranceAccepted: ["Alliance", "AmeriHealth", "Medicaid"],
        sourceUrl: "https://nctracks.nc.gov/provider/123456",
        metadata: { providerId: "123456", enrollmentDate: "2024-01-15" },
      },
      {
        name: "Triangle Behavioral Health",
        phone: "(919) 555-0102",
        email: "info@trianglebehavioral.com",
        address: "456 Health Plaza",
        city: "Durham",
        zipCode: "27701",
        services: ["Adolescent Counseling", "Family Therapy"],
        insuranceAccepted: ["Alliance", "Carolina Complete"],
        sourceUrl: "https://nctracks.nc.gov/provider/789012",
        metadata: { providerId: "789012", enrollmentDate: "2023-08-22" },
      },
    ];
  }

  private async importLeads(leads: ScrapedLead[], organizationId: string): Promise<number> {
    let importedCount = 0;
    const admin = this.getAdminClient();
    const historicalPattern = await this.loadHistoricalPattern(organizationId);

    for (const lead of leads) {
      const { data: existingRaw } = await admin
        .from("leads")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("name", lead.name)
        .eq("zip_code", lead.zipCode)
        .maybeSingle();

      const existing = existingRaw as LeadIdRow | null;

      if (existing?.id) {
        console.log(`[NCTracks Scraper] Skipping duplicate lead: ${lead.name}`);
        continue;
      }

      const services = normalizeStringArray(lead.services);
      const insurance = normalizeStringArray(lead.insuranceAccepted);
      const scoringInput: LeadForScoring = {
        name: lead.name,
        city: lead.city,
        location: `${lead.city}, NC`,
        zipCode: lead.zipCode,
        insurance: insurance[0] ?? null,
        services,
      };
      const scoreResult = await scoreLead(scoringInput, historicalPattern);

      const { error } = await admin.from("leads").insert({
        organization_id: organizationId,
        name: lead.name,
        phone: lead.phone ?? null,
        email: lead.email ?? null,
        location: `${lead.city}, NC`,
        zip_code: lead.zipCode,
        need_type: services.join(", ") || "Mental Health",
        insurance_type: insurance[0] ?? "Unknown",
        source: "NCTracks",
        source_url: lead.sourceUrl,
        quality_score: scoreResult.score,
        priority: scoreResult.priority[0].toUpperCase() + scoreResult.priority.slice(1),
        ai_reasoning: scoreResult.reasoning,
        scraper_metadata: lead.metadata,
        status: "new",
      });

      if (!error) {
        importedCount += 1;
      } else {
        console.error(`[NCTracks Scraper] Failed to import lead ${lead.name}: ${error.message}`);
      }
    }

    return importedCount;
  }

  private async loadHistoricalPattern(organizationId: string) {
    const admin = this.getAdminClient();
    const { data } = await admin
      .from("clients")
      .select(
        "age,city,zip_code,diagnosis_code_1,diagnosis_code_2,primary_payer,lead_quality_score"
      )
      .eq("organization_id", organizationId)
      .not("lead_quality_score", "is", null)
      .limit(5000);

    const rows = (data ?? []) as ClientPatternRow[];
    return buildHistoricalPattern(rows);
  }
}
