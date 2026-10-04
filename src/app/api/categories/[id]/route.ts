import { fail, ok } from "@/lib/api";
import { getDocuments, updateDocument, deleteDocument } from "@/lib/firestore/genericRepository";

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const items = await getDocuments("items");
    const itemsUsing = items.find((i: any) => String(i.mainCategoryId) === String(params.id) || String(i.subCategoryId) === String(params.id));
    if (itemsUsing) {
      return fail("Cannot delete category. There are items associated with it.");
    }

    const categories = await getDocuments("categories");
    const hasSubs = categories.find((c: any) => String(c.parentId) === String(params.id));
    if (hasSubs) {
      return fail("Cannot delete category. It has sub-categories associated with it.");
    }

    await deleteDocument("categories", params.id);
    return ok({ message: "Deleted successfully" });
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const row = await updateDocument("categories", params.id, body);
    return ok(row);
  } catch (e) {
    return fail((e as Error).message);
  }
}
