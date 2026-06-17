import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/db/supabase/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const sb = await createSupabaseServerClient();
    const {
      data: { user },
    } = await sb.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const admin = createSupabaseAdminClient();
    const { data: userRow, error: userErr } = await admin
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .limit(1)
      .maybeSingle();

    if (userErr || !userRow?.organization_id) {
      return NextResponse.json(
        { ok: false, error: userErr?.message ?? "Missing organization" },
        { status: 500 }
      );
    }

    const orgId = userRow.organization_id as string;

    const { data: lead, error } = await admin
      .from("leads")
      .select(
        "id,name,first_name,last_name,email,phone,phone_home,date_of_birth,address_line1,city,state,zip,insurance_type,insurance_payer,insurance_id,need_type,location,source,source_url,status,urgency,qualification_status,qualification_score,created_at,assigned_to,contacted_at,response_time_hours,lost_reason"
      )
      .eq("id", id)
      .eq("organization_id", orgId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    if (!lead) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, lead });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));

    const sb = await createSupabaseServerClient();
    const {
      data: { user },
    } = await sb.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const admin = createSupabaseAdminClient();

    const { data: userRow, error: userErr } = await admin
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .limit(1)
      .maybeSingle();

    if (userErr || !userRow?.organization_id) {
      return NextResponse.json(
        { ok: false, error: userErr?.message ?? "Missing organization" },
        { status: 500 }
      );
    }

    const orgId = userRow.organization_id as string;

    const patch: Record<string, any> = {};
    if (typeof body.status === "string" && body.status) patch.status = body.status;

    // Lead detail fields for editing
    if (typeof body.first_name === "string") patch.first_name = body.first_name || null;
    if (typeof body.last_name === "string") patch.last_name = body.last_name || null;
    if (typeof body.phone === "string") patch.phone = body.phone || null;
    if (typeof body.date_of_birth === "string") patch.date_of_birth = body.date_of_birth || null;
    if (typeof body.insurance_id === "string") patch.insurance_id = body.insurance_id || null;
    if (typeof body.insurance_payer === "string") patch.insurance_payer = body.insurance_payer || null;
    if (typeof body.address_line1 === "string") patch.address_line1 = body.address_line1 || null;
    if (typeof body.city === "string") patch.city = body.city || null;
    if (typeof body.state === "string") patch.state = body.state || null;
    if (typeof body.zip === "string") patch.zip = body.zip || null;

    if (Object.keys(patch).length) {
      const { error } = await admin
        .from("leads")
        .update(patch)
        .eq("id", id)
        .eq("organization_id", orgId);

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }
    }

    if (body.assignToMe === true) {
      await admin.from("activities").insert([
        {
          lead_id: id,
          user_id: user.id,
          action: "lead_assigned_to_me",
          notes: JSON.stringify({ assigned_user_id: user.id }),
        },
      ]);
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
