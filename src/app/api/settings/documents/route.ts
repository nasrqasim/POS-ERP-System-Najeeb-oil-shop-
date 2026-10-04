import { fail, ok } from "@/lib/api";
import { getDocuments, createDocument, updateDocument } from "@/lib/firestore/genericRepository";

export async function GET() {
  try {
    const settings = await getDocuments("document_settings");
    
    if (settings.length === 0) {
      const defaults = [
        { type: "Sale Invoice", prefix: "INV-", nextNo: 1, padding: 3 },
        { type: "Purchase Order", prefix: "PO-", nextNo: 1, padding: 4 },
        { type: "Quotation", prefix: "QT-", nextNo: 1, padding: 3 },
        { type: "Cash Receipt", prefix: "CR-", nextNo: 1, padding: 5 },
        { type: "GRN", prefix: "GRN-", nextNo: 1, padding: 4 },
      ];
      const created = [];
      for (const d of defaults) {
        const row = await createDocument("document_settings", d);
        created.push(row);
      }
      return ok(created);
    }
    
    return ok(settings);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { settings } = body;

    if (!Array.isArray(settings)) return fail("Invalid data format");

    const existing = await getDocuments("document_settings");

    for (const s of settings) {
      const match = existing.find((e: any) => e.type === s.type);
      if (match) {
        await updateDocument("document_settings", match._id, { prefix: s.prefix, nextNo: s.nextNo, padding: s.padding });
      } else {
        await createDocument("document_settings", { type: s.type, prefix: s.prefix, nextNo: s.nextNo, padding: s.padding });
      }
    }

    return ok({ message: "Settings saved successfully" });
  } catch (e) {
    return fail((e as Error).message);
  }
}

export const dynamic = "force-dynamic";
