import { ok } from "@/lib/api";
import { getDocuments } from "@/lib/firestore/genericRepository";

function getLineQty(line: any): number {
  const cartons = Number(line.cartons) || 0;
  const qty = Number(line.qty) || 0;
  if (cartons > 0) return cartons;
  if (qty > 0) return qty;
  const liters = Number(line.liters) || 0;
  const gallons = Number(line.gallons) || 0;
  if (liters > 0) return liters;
  if (gallons > 0) return gallons;
  return 0;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");

    const fromTime = fromDate ? new Date(fromDate).setHours(0, 0, 0, 0) : 0;
    const toTime = toDate ? new Date(toDate).setHours(23, 59, 59, 999) : Infinity;

    const allEntries = await getDocuments("journal_entries");
    const filteredEntries = allEntries.filter((j: any) => {
      const t = new Date(j.date || 0).getTime();
      return t >= fromTime && t <= toTime;
    });

    const balanceMap = new Map<string, { debit: number; credit: number }>();
    for (const j of filteredEntries) {
      const code = j.accountCode;
      if (!code) continue;
      let curr = balanceMap.get(code);
      if (!curr) {
        curr = { debit: 0, credit: 0 };
        balanceMap.set(code, curr);
      }
      curr.debit += Number(j.debit || 0);
      curr.credit += Number(j.credit || 0);
    }

    const accounts = await getDocuments("accounts");
    const accountMap = new Map(accounts.map((a: any) => [a.code, a]));

    const allInvoices = await getDocuments("invoices");
    const periodInvoices = allInvoices.filter((inv: any) => {
      if (inv.status === "cancelled" || inv.status === "Cancelled") return false;
      const t = new Date(inv.date || 0).getTime();
      return t >= fromTime && t <= toTime;
    });

    const items = await getDocuments("items");

    const OUT_TYPES = new Set(["sale", "non_tax_sale", "pos", "pos_counter_sale", "reduce_stock", "challan"]);
    const OUT_RETURN_TYPES = new Set(["purchase_return", "non_tax_purchase_return"]);

    let totalCogs = 0;
    items.forEach((item: any) => {
      let qtyOut = 0;
      periodInvoices.forEach((inv: any) => {
        const invType = String(inv.type || "");
        const isOut = OUT_TYPES.has(invType);
        const isOutReturn = OUT_RETURN_TYPES.has(invType);
        if (!isOut && !isOutReturn) return;

        (inv.lines || []).forEach((line: any) => {
          const lineItemId = typeof line.itemId === "object" ? line.itemId?._id : line.itemId;
          if (String(lineItemId) !== String(item._id)) return;

          const qty = getLineQty(line);
          if (qty > 0) {
            if (isOut) qtyOut += qty;
            if (isOutReturn) qtyOut -= qty;
          }
        });
      });
      totalCogs += qtyOut * Number(item.purchaseRate || 0);
    });

    const SALE_TYPES = new Set(["sale", "non_tax_sale", "pos", "pos_counter_sale"]);
    const SALE_RETURN_TYPES = new Set(["sale_return", "non_tax_sale_return"]);

    let salesInvoiceRevenue = 0;
    periodInvoices.forEach((inv: any) => {
      const invType = String(inv.type || "");
      const amt = Number(inv.totalAmount || inv.total || inv.netAmount || 0);
      if (SALE_TYPES.has(invType)) salesInvoiceRevenue += amt;
      if (SALE_RETURN_TYPES.has(invType)) salesInvoiceRevenue -= amt;
    });

    const report = {
      revenue: [] as any[],
      expenses: [] as any[],
      totalRevenue: 0,
      totalExpenses: 0,
      netProfit: 0
    };

    if (salesInvoiceRevenue > 0) {
      report.revenue.push({ title: "Sales Revenue", amount: salesInvoiceRevenue });
      report.totalRevenue += salesInvoiceRevenue;
    }

    const titleMap = new Map();
    filteredEntries.forEach((j: any) => {
      if (j.accountCode && !titleMap.has(j.accountCode)) {
        titleMap.set(j.accountCode, j.accountTitle);
      }
    });

    balanceMap.forEach((journal, code) => {
      if (code === "5100" || code === "4100") return;

      const acc = accountMap.get(code);
      let type = acc ? String(acc.type || "").toLowerCase() : "";

      if (!type) {
        if (code.startsWith("4")) type = "income";
        else if (code.startsWith("5")) type = "expense";
        else return;
      } else if (type === "revenue") {
        type = "income";
      }

      const title = acc ? acc.title : (titleMap.get(code) || `Account ${code}`);

      if (type === "income" || type === "revenue") {
        const balance = (journal.credit - journal.debit);
        if (balance !== 0) {
          report.revenue.push({ title, amount: balance });
          report.totalRevenue += balance;
        }
      } else if (type === "expense") {
        const balance = (journal.debit - journal.credit);
        if (balance !== 0) {
          report.expenses.push({ title, amount: balance });
          report.totalExpenses += balance;
        }
      }
    });

    if (totalCogs > 0) {
      report.expenses.push({ title: "Cost of Goods Sold (COGS)", amount: totalCogs });
      report.totalExpenses += totalCogs;
    }

    report.netProfit = report.totalRevenue - report.totalExpenses;

    return ok(report);
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
