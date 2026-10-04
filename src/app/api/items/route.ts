import { fail, ok } from "@/lib/api";
import { getAllItems, createItem } from "@/lib/firestore/itemsRepository";

export async function GET() {
  try {
    const rows = await getAllItems();
    return ok(rows);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const row = await createItem(body);
    return ok(row, 201);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export const dynamic = "force-dynamic";
