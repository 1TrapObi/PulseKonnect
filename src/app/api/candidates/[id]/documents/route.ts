import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/db/supabase/server";

const BUCKET = "candidate-documents";

async function getOrgIdForUser(admin: any, userId: string) {
  const { data } = await admin
    .from("users")
    .select("organization_id")
    .eq("id", userId)
    .limit(1)
    .maybeSingle();
  return (data?.organization_id as string | undefined) ?? null;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
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
    const orgId = await getOrgIdForUser(admin, user.id);
    if (!orgId) {
      return NextResponse.json({ ok: false, error: "Missing organization" }, { status: 500 });
    }

    const { data: candidateRow } = await admin
      .from("candidates")
      .select("id")
      .eq("id", id)
      .eq("organization_id", orgId)
      .maybeSingle();

    if (!candidateRow) {
      return NextResponse.json({ ok: false, error: "Candidate not found" }, { status: 404 });
    }

    const form = await request.formData();
    const file = form.get("file");
    const fileType = form.get("fileType") ? String(form.get("fileType")) : "other";

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Missing file" }, { status: 400 });
    }

    const safeName = String(file.name || "document").replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `${id}/${Date.now()}-${safeName}`;

    const uploadResp = await admin.storage.from(BUCKET).upload(filePath, file, {
      contentType: file.type || undefined,
      upsert: false,
    });

    if (uploadResp.error) {
      return NextResponse.json({ ok: false, error: uploadResp.error.message }, { status: 500 });
    }

    const publicUrl = admin.storage.from(BUCKET).getPublicUrl(filePath).data.publicUrl;

    const { data: doc, error } = await admin
      .from("candidate_documents")
      .insert([
        {
          candidate_id: id,
          filename: safeName,
          file_url: publicUrl,
          file_type: fileType,
          uploaded_by: user.id,
        },
      ])
      .select("id,candidate_id,filename,file_url,file_type,uploaded_by,uploaded_at")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    await admin.from("activities").insert([
      {
        candidate_id: id,
        user_id: user.id,
        action: "candidate_document_uploaded",
        notes: JSON.stringify({ file_type: fileType, filename: safeName }),
      },
    ]);

    return NextResponse.json({ ok: true, document: doc });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
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
    const orgId = await getOrgIdForUser(admin, user.id);
    if (!orgId) {
      return NextResponse.json({ ok: false, error: "Missing organization" }, { status: 500 });
    }

    const { data: candidateRow } = await admin
      .from("candidates")
      .select("id")
      .eq("id", id)
      .eq("organization_id", orgId)
      .maybeSingle();

    if (!candidateRow) {
      return NextResponse.json({ ok: false, error: "Candidate not found" }, { status: 404 });
    }

    const { data, error } = await admin
      .from("candidate_documents")
      .select("id,candidate_id,filename,file_url,file_type,uploaded_by,uploaded_at")
      .eq("candidate_id", id)
      .order("uploaded_at", { ascending: false });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, documents: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
