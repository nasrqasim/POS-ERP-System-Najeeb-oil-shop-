import { fail, ok } from "@/lib/api";
import { getDocuments, updateDocument, deleteDocument } from "@/lib/firestore/genericRepository";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    if (body.isDefault) {
      const existing = await getDocuments("banks");
      for (const b of existing) {
        if (b._id !== params.id && b.isDefault) {
          await updateDocument("banks", b._id, { isDefault: false });
        }
      }
    }
    const row = await updateDocument("banks", params.id, body);
    if (!row) return fail("Bank not found", 404);
    return ok(row);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    await deleteDocument("banks", params.id);
    return ok({ deleted: true });
  } catch (e) {
    return fail((e as Error).message);
  }
}
