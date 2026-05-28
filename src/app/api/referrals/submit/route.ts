import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/db/supabase/server";
import { sendEmail } from "@/lib/email/send";
import { ReferralSubmittedEmail, referralSubmittedSubject } from "@/lib/email/templates/referral-submitted";

type ReferralSubmitBody = {
  organizationSlug?: unknown;
  name?: unknown;
  dateOfBirth?: unknown;
  email?: unknown;
  phone?: unknown;
  serviceNeeded?: unknown;
  urgency?: unknown;
  location?: unknown;
  insuranceType?: unknown;
  medicaidNumber?: unknown;
  referralAgency?: unknown;
  referralContactName?: unknown;
  referralContactEmail?: unknown;
  notes?: unknown;
};

type OrganizationRow = {
  id: string;
  name: string | null;
  slug: string | null;
};

type LeadIdRow = {
  id: string;
};

type AdminEmailRow = {
  email: string | null;
};

function corsHeaders() {
  const origin = process.env.REFERRAL_FORM_ORIGIN ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  } as Record<string, string>;
}

function asOptionalString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s : null;
}

function asOptionalDate(v: unknown): string | null {
  const s = asOptionalString(v);
  if (!s) return null;
  const date = new Date(s);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function asOptionalEnum(v: unknown, allowed: string[]): string | null {
  const s = asOptionalString(v);
  if (!s) return null;
  return allowed.includes(s) ? s : null;
}

function appBaseUrlFromRequest(request: Request) {
  try {
    const url = new URL(request.url);
    return `${url.protocol}//${url.host}`;
  } catch {
    return process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(),
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as ReferralSubmitBody | null;

    const organizationSlug = asOptionalString(body?.organizationSlug);
    const name = asOptionalString(body?.name);
    const date_of_birth = asOptionalDate(body?.dateOfBirth);
    const email = asOptionalString(body?.email);
    const phone = asOptionalString(body?.phone);
    const need_type = asOptionalString(body?.serviceNeeded);
    const urgency =
      asOptionalEnum(body?.urgency, ["low", "medium", "high", "urgent"]) ?? "medium";
    const location = asOptionalString(body?.location);
    const insurance_type = asOptionalString(body?.insuranceType);
    const medicaid_number = asOptionalString(body?.medicaidNumber);
    const referral_agency = asOptionalString(body?.referralAgency);
    const referral_contact_name = asOptionalString(body?.referralContactName);
    const referral_contact_email = asOptionalString(body?.referralContactEmail);
    const notes = asOptionalString(body?.notes);

    if (!organizationSlug || !name || !phone || !need_type) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields" },
        { status: 400, headers: corsHeaders() }
      );
    }

    const admin = createSupabaseAdminClient();

    const { data: org, error: orgError } = await admin
      .from("organizations")
      .select("id,name,slug")
      .eq("slug", organizationSlug)
      .maybeSingle<OrganizationRow>();

    if (orgError || !org?.id) {
      return NextResponse.json(
        { ok: false, error: "Organization not found" },
        { status: 404, headers: corsHeaders() }
      );
    }

    const { data: lead, error: leadError } = await admin
      .from("leads")
      .insert({
        organization_id: org.id,
        name,
        date_of_birth,
        email,
        phone,
        location,
        need_type,
        urgency,
        insurance_type,
        medicaid_number,
        source: "Referral page",
        referral_agency,
        referral_contact_name,
        referral_contact_email,
        notes,
        status: "new",
      })
      .select("id")
      .maybeSingle<LeadIdRow>();

    if (leadError) {
      return NextResponse.json(
        { ok: false, error: "Failed to create lead" },
        { status: 500, headers: corsHeaders() }
      );
    }

    const leadId = String(lead?.id ?? "");

    const { data: admins } = await admin
      .from("users")
      .select("email")
      .eq("organization_id", org.id)
      .eq("role", "admin")
      .returns<AdminEmailRow[]>();

    const to = (admins ?? [])
      .map((a) => String(a.email ?? "").trim())
      .filter(Boolean);

    if (to.length) {
      const href = `${appBaseUrlFromRequest(request)}/leads/${leadId || ""}`;

      try {
        await Promise.all(
          to.map((addr) =>
            sendEmail({
              to: addr,
              subject: referralSubmittedSubject(name),
              react: ReferralSubmittedEmail({
                organizationName: String(org.name ?? ""),
                leadName: name,
                phone,
                email,
                needType: need_type,
                urgency,
                location,
                insuranceType: insurance_type,
                medicaidNumber: medicaid_number,
                referralAgency: referral_agency,
                referralContactName: referral_contact_name,
                referralContactEmail: referral_contact_email,
                notes,
                href,
              }),
            })
          )
        );
      } catch {
        // ignore email failure
      }
    }

    return NextResponse.json(
      { ok: true, leadId },
      {
        status: 200,
        headers: corsHeaders(),
      }
    );
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Internal server error" },
      { status: 500, headers: corsHeaders() }
    );
  }
}
