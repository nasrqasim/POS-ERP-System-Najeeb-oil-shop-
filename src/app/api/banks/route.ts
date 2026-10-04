import { fail, ok } from "@/lib/api";
import { getDocuments, createDocument, updateDocument } from "@/lib/firestore/genericRepository";

export async function GET() {
  try {
    const rows = await getDocuments("banks");
    rows.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    return ok(rows);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (body.isDefault) {
      const existing = await getDocuments("banks");
      for (const b of existing) {
        if (b.isDefault) {
          await updateDocument("banks", b._id, { isDefault: false });
        }
      }
    }
    const row = await createDocument("banks", body);
    return ok(row, 201);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export const dynamic = "force-dynamic";
