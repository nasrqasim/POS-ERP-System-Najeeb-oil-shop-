import { ok } from "@/lib/api";
import { getDocuments } from "@/lib/firestore/genericRepository";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");

    const accounts = await getDocuments("accounts");
    const cbAccounts = accounts.filter((a: any) => ["cash", "bank"].includes(String(a.type || "").toLowerCase()));
    const cbCodes = new Set(cbAccounts.map((a: any) => a.code));

    const allEntries = await getDocuments("journal_entries");

    const fromTime = fromDate ? new Date(fromDate).getTime() : 0;
    const toTime = toDate ? new Date(toDate).getTime() : Infinity;

    let openingBalance = 0;
    let totalInflow = 0;
    let totalOutflow = 0;
    const operating: any[] = [];

    for (const m of allEntries) {
      if (!cbCodes.has(m.accountCode)) continue;
      const t = new Date(m.date || 0).getTime();

      const debit = Number(m.debit) || 0;
      const credit = Number(m.credit) || 0;

      if (fromDate && t < fromTime) {
        openingBalance += (debit - credit);
      } else if (t >= fromTime && t <= toTime) {
        if (debit > 0) totalInflow += debit;
        if (credit > 0) totalOutflow += credit;

        operating.push({
          date: m.date,
          remarks: m.remarks,
          amount: debit - credit
        });
      }
    }

    const closingBalance = openingBalance + totalInflow - totalOutflow;

    return ok({
      openingBalance,
      totalInflow,
      totalOutflow,
      closingBalance,
      details: {
        operating,
        investing: [],
        financing: []
      }
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
