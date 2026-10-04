import { ok } from "@/lib/api";
import { getDocuments } from "@/lib/firestore/genericRepository";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const fromDateStr = searchParams.get("fromDate");
    const toDateStr = searchParams.get("toDate");

    const fromTime = fromDateStr ? new Date(fromDateStr).getTime() : 0;
    const toTime = toDateStr ? new Date(toDateStr).getTime() : Infinity;

    const accounts = await getDocuments("accounts");
    const cbAccounts = accounts.filter((a: any) => ["cash", "bank"].includes(String(a.type || "").toLowerCase()));
    const cbCodes = new Set(cbAccounts.map((a: any) => a.code));

    const allEntries = await getDocuments("journal_entries");

    let openingBalance = 0;
    let totalInflow = 0;
    let totalOutflow = 0;

    for (const j of allEntries) {
      if (!cbCodes.has(j.accountCode)) continue;
      const t = new Date(j.date || 0).getTime();
      const debit = Number(j.debit) || 0;
      const credit = Number(j.credit) || 0;

      if (t < fromTime) {
        openingBalance += (debit - credit);
      } else if (t >= fromTime && t <= toTime) {
        totalInflow += debit;
        totalOutflow += credit;
      }
    }

    const closingBalance = openingBalance + totalInflow - totalOutflow;

    const invoices = await getDocuments("invoices");
    const parties = await getDocuments("parties");
    const partyMap = new Map(parties.map((p: any) => [String(p._id), p.name || p.companyName]));

    const payables = invoices.filter((p: any) => 
      p.type === "purchase" && ["posted", "received"].includes(p.status)
    ).map((p: any) => ({
      vendor: partyMap.get(String(p.partyId)) || "Unknown",
      invoiceNo: p.invoiceNo,
      amount: p.totalAmount,
      dueDate: p.dueDate
    })).slice(0, 10);

    const receivables = invoices.filter((r: any) => 
      r.type === "sale" && ["posted", "delivered"].includes(r.status)
    ).map((r: any) => ({
      customer: partyMap.get(String(r.partyId)) || "Unknown",
      invoiceNo: r.invoiceNo,
      amount: r.totalAmount,
      dueDate: r.dueDate
    })).slice(0, 10);

    return ok({
      openingBalance,
      totalInflow,
      totalOutflow,
      closingBalance,
      payables,
      receivables,
      waterfall: [
        { name: 'Opening', value: openingBalance, type: 'total' },
        { name: 'Total Inflow', value: totalInflow, type: 'inflow' },
        { name: 'Total Outflow', value: -totalOutflow, type: 'outflow' },
        { name: 'Closing', value: closingBalance, type: 'total' },
      ]
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
