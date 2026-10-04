import { fail, ok } from "@/lib/api";
import { getDocuments, createDocument, updateDocument } from "@/lib/firestore/genericRepository";

export async function GET() {
  try {
    const rows = await getDocuments("locations");
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
      const existing = await getDocuments("locations");
      for (const loc of existing) {
        if (loc.isDefault) {
          await updateDocument("locations", loc._id, { isDefault: false });
        }
      }
    }
    const row = await createDocument("locations", body);
    return ok(row, 201);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export const dynamic = "force-dynamic";
