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

function tryParseStoragePathFromUrl(url: string) {
  try {
    const u = new URL(url);
    const idx = u.pathname.indexOf(`/storage/v1/object/public/${BUCKET}/`);
    if (idx >= 0) {
      return u.pathname.slice(idx + `/storage/v1/object/public/${BUCKET}/`.length);
    }
  } catch {
    return null;
  }
  return null;
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { id, docId } = await context.params;

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

    const { data: docRow, error: docErr } = await admin
      .from("candidate_documents")
      .select("id,file_url,filename")
      .eq("id", docId)
      .eq("candidate_id", id)
      .maybeSingle();

    if (docErr) {
      return NextResponse.json({ ok: false, error: docErr.message }, { status: 500 });
    }

    if (!docRow) {
      return NextResponse.json({ ok: false, error: "Document not found" }, { status: 404 });
    }

    const storagePath = tryParseStoragePathFromUrl(String((docRow as any).file_url ?? ""));
    if (storagePath) {
      await admin.storage.from(BUCKET).remove([storagePath]);
    }

    const { error } = await admin
      .from("candidate_documents")
      .delete()
      .eq("id", docId)
      .eq("candidate_id", id);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    await admin.from("activities").insert([
      {
        candidate_id: id,
        user_id: user.id,
        action: "candidate_document_deleted",
        notes: JSON.stringify({ filename: (docRow as any).filename ?? null }),
      },
    ]);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
