import { fail, ok } from "@/lib/api";
import { deleteDocument } from "@/lib/firestore/genericRepository";

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await deleteDocument("roles", params.id);
    return ok({ message: "Role deleted successfully" });
  } catch (e) {
    return fail((e as Error).message);
  }
}
