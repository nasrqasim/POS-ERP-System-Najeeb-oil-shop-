import { fail, ok } from "@/lib/api";
import { updateDocument, deleteDocument } from "@/lib/firestore/genericRepository";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();
    const updatedYear = await updateDocument("financial_years", id, body);
    return ok(updatedYear);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    await deleteDocument("financial_years", id);
    return ok({ message: "Financial year deleted successfully" });
  } catch (e) {
    return fail((e as Error).message);
  }
}
