import { fail, ok } from "@/lib/api";
import { getAllCategories, createCategory } from "@/lib/firestore/itemsRepository";

export async function GET() {
  try {
    const rows = await getAllCategories();
    return ok(rows);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const row = await createCategory(body);
    return ok(row, 201);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export const dynamic = "force-dynamic";
