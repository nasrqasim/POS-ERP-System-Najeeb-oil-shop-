import { ok } from "@/lib/api";
import { getDocuments } from "@/lib/firestore/genericRepository";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").toLowerCase().trim();

    const allParties = await getDocuments("parties");
    let parties = allParties.filter((p: any) => p.type === "Customer" && p.status !== "Inactive" && p.status !== "Disabled");

    if (q) {
      parties = parties.filter((p: any) => 
        String(p.name || "").toLowerCase().includes(q) ||
        String(p.companyName || "").toLowerCase().includes(q) ||
        String(p.code || "").toLowerCase().includes(q) ||
        String(p.phone || "").toLowerCase().includes(q) ||
        String(p.mobile || "").toLowerCase().includes(q)
      );

      if (q.length >= 2) {
        const allInvoices = await getDocuments("invoices");
        const matchingInvoices = allInvoices.filter((inv: any) => inv.regNo && String(inv.regNo).toLowerCase().includes(q) && inv.partyId);
        const partyIdsFromReg = new Set(matchingInvoices.map((inv: any) => String(inv.partyId)));

        if (partyIdsFromReg.size > 0) {
          const existingIds = new Set(parties.map((p: any) => String(p._id)));
          for (const p of allParties) {
            if (partyIdsFromReg.has(String(p._id)) && p.type === "Customer" && p.status !== "Inactive" && p.status !== "Disabled") {
              if (!existingIds.has(String(p._id))) {
                parties.push(p);
              }
            }
          }
        }
      }
    }

    if (parties.length > 100) {
      parties = parties.slice(0, 100);
    }

    return ok(parties);
  } catch (error: any) {
    console.error("Parties search error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
