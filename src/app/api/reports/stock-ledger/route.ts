import { fail, ok } from "@/lib/api";
import { getDocuments } from "@/lib/firestore/genericRepository";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const itemId = searchParams.get("itemId");
  if (!itemId) return fail("itemId is required");

  const invoices = await getDocuments("invoices");
  const filtered = invoices.filter((inv: any) => {
    if (!Array.isArray(inv.lines)) return false;
    return inv.lines.some((l: any) => {
      const id = typeof l.itemId === "object" ? l.itemId?._id : l.itemId;
      return String(id) === String(itemId);
    });
  });

  filtered.sort((a: any, b: any) => new Date(b.date || b.createdAt || 0).getTime() - new Date(a.date || a.createdAt || 0).getTime());

  return ok(filtered.map((inv: any) => ({
    _id: inv._id,
    invoiceNo: inv.invoiceNo,
    type: inv.type,
    date: inv.date,
    lines: inv.lines
  })));
}

export const dynamic = "force-dynamic";
