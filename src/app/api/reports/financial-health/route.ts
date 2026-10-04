import { ok } from "@/lib/api";
import { getDocuments } from "@/lib/firestore/genericRepository";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get("date");
    const targetDate = dateStr ? new Date(dateStr).getTime() : Date.now();

    const allEntries = await getDocuments("journal_entries");
    const filtered = allEntries.filter((j: any) => new Date(j.date || 0).getTime() <= targetDate);

    const balanceMap = new Map<string, number>();
    for (const j of filtered) {
      const code = j.accountCode;
      if (!code) continue;
      const curr = balanceMap.get(code) || 0;
      balanceMap.set(code, curr + (Number(j.debit || 0) - Number(j.credit || 0)));
    }

    const accounts = await getDocuments("accounts");
    const accountMap = new Map(accounts.map((a: any) => [a.code, a]));

    let currentAssets = 0;
    let quickAssets = 0;
    let currentLiabilities = 0;
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;
    let revenue = 0;
    let expenses = 0;

    balanceMap.forEach((balance, code) => {
      const acc = accountMap.get(code);
      let type = acc ? String(acc.type || "").toLowerCase() : "";

      if (!type) {
        if (code.startsWith("1")) type = "asset";
        else if (code.startsWith("2")) type = "payable";
        else if (code.startsWith("3")) type = "equity";
        else if (code.startsWith("4")) type = "income";
        else if (code.startsWith("5")) type = "expense";
        else return;
      } else if (type === "revenue") type = "income";
      else if (type === "liability") type = "payable";

      if (type === "income") {
        revenue += Math.abs(balance);
      } else if (type === "expense") {
        expenses += balance;
      } else if (["cash", "bank", "receivable"].includes(type)) {
        currentAssets += balance;
        quickAssets += balance;
      } else if (type === "asset") {
        totalAssets += balance;
      } else if (type === "payable") {
        currentLiabilities += Math.abs(balance);
      } else if (type === "equity") {
        totalEquity += Math.abs(balance);
      }
    });

    totalAssets += currentAssets;
    totalLiabilities += currentLiabilities;
    const netProfit = revenue - expenses;
    totalEquity += netProfit;

    const currentRatio = currentLiabilities > 0 ? (currentAssets / currentLiabilities) : 0;
    const quickRatio = currentLiabilities > 0 ? (quickAssets / currentLiabilities) : 0;
    const debtToEquity = totalEquity > 0 ? (totalLiabilities / totalEquity) : 0;
    const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
    const workingCapital = currentAssets - currentLiabilities;

    return ok({
      metrics: [
        { name: "Current Ratio", value: currentRatio.toFixed(2), target: "2.00", status: currentRatio >= 1.5 ? "Good" : "Warning" },
        { name: "Quick Ratio", value: quickRatio.toFixed(2), target: "1.00", status: quickRatio >= 1.0 ? "Good" : "Warning" },
        { name: "Debt-to-Equity", value: debtToEquity.toFixed(2), target: "1.50", status: debtToEquity <= 1.5 ? "Good" : "Warning" },
        { name: "Net Margin %", value: netMargin.toFixed(1) + "%", target: "15.0%", status: netMargin >= 10 ? "Good" : "Warning" },
        { name: "Working Capital", value: "Rs." + (workingCapital / 1000).toFixed(1) + "K", target: "> 0", status: workingCapital > 0 ? "Good" : "Warning" },
      ],
      raw: {
        currentRatio,
        quickRatio,
        debtToEquity,
        netMargin,
        workingCapital
      }
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
