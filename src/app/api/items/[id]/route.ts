import { fail, ok } from "@/lib/api";
import { getDocumentById, updateDocument, deleteDocument } from "@/lib/firestore/genericRepository";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const row = await getDocumentById("items", params.id);
    if (!row) return fail("Item not found", 404);
    return ok(row);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const row = await updateDocument("items", params.id, body);
    if (!row) return fail("Item not found", 404);
    return ok(row);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    await deleteDocument("items", params.id);
    return ok({ deleted: true });
  } catch (e) {
    return fail((e as Error).message);
  }
}

export const dynamic = "force-dynamic";
