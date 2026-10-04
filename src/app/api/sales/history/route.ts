import { fail, ok } from "@/lib/api";
import { getDocuments } from "@/lib/firestore/genericRepository";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const partyId = searchParams.get("partyId");
  const itemId = searchParams.get("itemId");
  if (!partyId || !itemId) return fail("partyId and itemId are required");

  const allInvoices = await getDocuments("invoices");
  const filtered = allInvoices.filter((inv: any) => String(inv.partyId) === String(partyId) && inv.type === "sale");

  filtered.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  const slice20 = filtered.slice(0, 20);

  const rates: any[] = [];
  for (const inv of slice20) {
    if (Array.isArray(inv.lines)) {
      for (const line of inv.lines) {
        if (String(line.itemId) === String(itemId)) {
          rates.push({ ratePerCarton: line.ratePerCarton, discountPercent: line.discountPercent ?? 0 });
        }
      }
    }
  }

  return ok(rates.slice(0, 5));
}

export const dynamic = "force-dynamic";
