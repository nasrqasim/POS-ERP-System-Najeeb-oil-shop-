import { ok } from "@/lib/api";
import { getDocuments } from "@/lib/firestore/genericRepository";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get("date");
    const targetDate = dateStr ? new Date(dateStr).getTime() : Date.now();

    const allEntries = await getDocuments("journal_entries");
    const filteredEntries = allEntries.filter((j: any) => {
      const d = new Date(j.date || 0).getTime();
      return d <= targetDate;
    });

    const balanceMap = new Map<string, { code: string; debit: number; credit: number; title: string }>();
    for (const j of filteredEntries) {
      const code = j.accountCode;
      if (!code) continue;
      let curr = balanceMap.get(code);
      if (!curr) {
        curr = { code, debit: 0, credit: 0, title: j.accountTitle || "" };
        balanceMap.set(code, curr);
      }
      curr.debit += Number(j.debit || 0);
      curr.credit += Number(j.credit || 0);
    }

    const accounts = await getDocuments("accounts");
    const accountMap = new Map();
    accounts.forEach(a => accountMap.set(a.code, a));

    const report = {
      assets: [] as any[],
      liabilities: [] as any[],
      equity: [] as any[],
      totalAssets: 0,
      totalLiabilities: 0,
      totalEquity: 0,
      netProfit: 0
    };

    let totalRevenue = 0;
    let totalExpenses = 0;

    balanceMap.forEach((journal, code) => {
      const acc = accountMap.get(code);
      let type = acc ? String(acc.type || "").toLowerCase() : "";

      if (!type) {
        if (code.startsWith("1")) type = "asset";
        else if (code.startsWith("2")) type = "payable";
        else if (code.startsWith("3")) type = "equity";
        else if (code.startsWith("4")) type = "income";
        else if (code.startsWith("5")) type = "expense";
        else return;
      } else if (type === "revenue") {
        type = "income";
      } else if (type === "liability") {
        type = "payable";
      }

      const title = acc ? acc.title : (journal.title || `Account ${code}`);

      if (type === "income") {
        totalRevenue += (journal.credit - journal.debit);
      } else if (type === "expense") {
        totalExpenses += (journal.debit - journal.credit);
      } else if (["cash", "bank", "receivable", "asset"].includes(type)) {
        const balance = (journal.debit - journal.credit);
        if (balance !== 0) {
          report.assets.push({ title, balance });
          report.totalAssets += balance;
        }
      } else if (["payable", "liability"].includes(type)) {
        const liabBalance = (journal.credit - journal.debit);
        if (liabBalance !== 0) {
          report.liabilities.push({ title, balance: liabBalance });
          report.totalLiabilities += liabBalance;
        }
      } else if (type === "equity") {
        const eqBalance = (journal.credit - journal.debit);
        if (eqBalance !== 0) {
          report.equity.push({ title, balance: eqBalance });
          report.totalEquity += eqBalance;
        }
      }
    });

    report.netProfit = totalRevenue - totalExpenses;
    report.totalEquity += report.netProfit;

    return ok(report);
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
