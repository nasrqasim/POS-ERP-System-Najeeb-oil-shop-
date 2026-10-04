import { fail, ok } from "@/lib/api";
import { getDocuments, updateDocument, deleteDocument } from "@/lib/firestore/genericRepository";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    if (body.isDefault) {
      const existing = await getDocuments("locations");
      for (const loc of existing) {
        if (loc._id !== params.id && loc.isDefault) {
          await updateDocument("locations", loc._id, { isDefault: false });
        }
      }
    }
    const row = await updateDocument("locations", params.id, body);
    if (!row) return fail("Location not found", 404);
    return ok(row);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    await deleteDocument("locations", params.id);
    return ok({ deleted: true });
  } catch (e) {
    return fail((e as Error).message);
  }
}
