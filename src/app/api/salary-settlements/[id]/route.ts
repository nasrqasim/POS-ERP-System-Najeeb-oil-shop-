import { fail, ok } from "@/lib/api";
import { updateDocument, deleteDocument } from "@/lib/firestore/genericRepository";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const row = await updateDocument("salary_settlements", params.id, body);
    if (!row) return fail("Not found", 404);
    return ok(row);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    await deleteDocument("salary_settlements", params.id);
    return ok({ deleted: true });
  } catch (e) {
    return fail((e as Error).message);
  }
}
