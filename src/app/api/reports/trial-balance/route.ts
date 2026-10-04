import { ok } from "@/lib/api";
import { getDocuments } from "@/lib/firestore/genericRepository";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");

    const fromTime = fromDate ? new Date(fromDate).getTime() : 0;
    const toTime = toDate ? new Date(toDate).getTime() : Infinity;

    const accounts = await getDocuments("accounts");
    const accountMap = new Map(accounts.map((a: any) => [a.code, a]));

    const entries = await getDocuments("journal_entries");
    const filteredEntries = entries.filter((j: any) => {
      const t = new Date(j.date || 0).getTime();
      return t >= fromTime && t <= toTime;
    });

    const balanceMap = new Map<string, { debit: number; credit: number; title: string }>();
    for (const j of filteredEntries) {
      const code = j.accountCode;
      if (!code) continue;
      let curr = balanceMap.get(code);
      if (!curr) {
        curr = { debit: 0, credit: 0, title: j.accountTitle || "" };
        balanceMap.set(code, curr);
      }
      curr.debit += Number(j.debit || 0);
      curr.credit += Number(j.credit || 0);
    }

    const reportData: any[] = [];
    
    balanceMap.forEach((journal, code) => {
      const acc = accountMap.get(code);
      const title = acc ? acc.title : (journal.title || `Account ${code}`);
      const type = acc ? acc.type : "Unknown";

      if (journal.debit > 0 || journal.credit > 0) {
        reportData.push({
          _id: acc ? acc._id : code,
          code: code,
          title: title,
          type: type,
          debit: journal.debit,
          credit: journal.credit
        });
      }
    });

    reportData.sort((a, b) => a.code.localeCompare(b.code));

    return ok(reportData);
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
