import { fail, ok } from "@/lib/api";
import { getDocuments } from "@/lib/firestore/genericRepository";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const allInvoices = await getDocuments("invoices");
    const validTypes = new Set(["sale", "sale_order", "quotation", "non_tax_sale", "pos_counter_sale", "sale_return", "non_tax_sale_return", "pos"]);
    const filtered = allInvoices.filter((inv: any) => validTypes.has(inv.type));

    const parties = await getDocuments("parties");
    const employees = await getDocuments("employees");
    const items = await getDocuments("items");

    const partyMap = new Map(parties.map((p: any) => [String(p._id), p]));
    const empMap = new Map(employees.map((e: any) => [String(e._id), e]));
    const itemMap = new Map(items.map((i: any) => [String(i._id), i]));

    const populated = filtered.map((inv: any) => {
      const p = inv.partyId ? partyMap.get(String(inv.partyId)) : null;
      const e = inv.employeeId ? empMap.get(String(inv.employeeId)) : null;
      const lines = Array.isArray(inv.lines) ? inv.lines.map((l: any) => {
        const itemObj = l.itemId ? itemMap.get(String(l.itemId)) : null;
        return {
          ...l,
          itemId: itemObj ? { _id: itemObj._id, name: itemObj.name, code: itemObj.code, category: itemObj.category, unit: itemObj.unit } : l.itemId
        };
      }) : [];

      return {
        ...inv,
        partyId: p ? { _id: p._id, name: p.name, companyName: p.companyName } : inv.partyId,
        employeeId: e ? { _id: e._id, name: e.name } : inv.employeeId,
        lines
      };
    });

    populated.sort((a: any, b: any) => new Date(b.date || b.createdAt || 0).getTime() - new Date(a.date || a.createdAt || 0).getTime());

    return ok(populated);
  } catch (e) {
    return fail((e as Error).message);
  }
}
