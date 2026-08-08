import { ok } from "@/lib/api";
import dbConnect from "@/lib/db";
import Account from "@/models/Account";
import JournalEntry from "@/models/JournalEntry";
import Invoice from "@/models/Invoice";
import Item from "@/models/Item";

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

    await dbConnect();

    const match: any = {};
    const invoiceMatch: any = { status: { $nin: ["cancelled", "Cancelled"] } };

    if (fromDate || toDate) {
      match.date = {};
      invoiceMatch.date = {};
      if (fromDate) {
        const fromD = new Date(fromDate);
        fromD.setHours(0, 0, 0, 0);
        match.date.$gte = fromD;
        invoiceMatch.date.$gte = fromD;
      }
      if (toDate) {
        const toD = new Date(toDate);
        toD.setHours(23, 59, 59, 999);
        match.date.$lte = toD;
        invoiceMatch.date.$lte = toD;
      }
    }

    const journalBalances = await JournalEntry.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$accountCode",
          debit: { $sum: "$debit" },
          credit: { $sum: "$credit" },
        },
      },
    ]);

    const balanceMap = new Map();
    journalBalances.forEach((jb) => {
      balanceMap.set(jb._id, jb);
    });

    const accounts = await Account.find().lean();
    const accountMap = new Map();
    accounts.forEach(a => accountMap.set(a.code, a));

    // Calculate COGS dynamically for the period
    const items = await Item.find().lean();
    const invoices = await Invoice.find(invoiceMatch).lean();

    const OUT_TYPES = new Set([
      "sale", "non_tax_sale", "pos", "pos_counter_sale", "reduce_stock", "challan"
    ]);
    const OUT_RETURN_TYPES = new Set([
      "purchase_return", "non_tax_purchase_return"
    ]);

    let totalCogs = 0;
    items.forEach(item => {
      let qtyOut = 0;
      invoices.forEach(inv => {
        const invType = String(inv.type || "");
        const isOut = OUT_TYPES.has(invType);
        const isOutReturn = OUT_RETURN_TYPES.has(invType);
        if (!isOut && !isOutReturn) return;

        (inv.lines || []).forEach((line: any) => {
          const lineItemId = line.itemId?._id || line.itemId;
          if (String(lineItemId) !== String(item._id)) return;

          const qty = getLineQty(line);
          if (qty > 0) {
            if (isOut) qtyOut += qty;
            if (isOutReturn) qtyOut -= qty;
          }
        });
      });
      totalCogs += qtyOut * (item.purchaseRate || 0);
    });

    // 1. Calculate Revenue from Invoices & Income Accounts
    const SALE_TYPES = new Set(["sale", "non_tax_sale", "pos", "pos_counter_sale"]);
    const SALE_RETURN_TYPES = new Set(["sale_return", "non_tax_sale_return"]);

    let salesInvoiceRevenue = 0;
    invoices.forEach(inv => {
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

    // Grab income / expense balances from Journal Entry
    const journalTitles = await JournalEntry.aggregate([
      { $match: match },
      { $group: { _id: "$accountCode", title: { $first: "$accountTitle" } } }
    ]);
    const titleMap = new Map(journalTitles.map((t: any) => [t._id, t.title]));

    balanceMap.forEach((journal, code) => {
      // Skip Purchases (5100) and Sales (4100) since we compute sales & COGS dynamically from invoices
      if (code === "5100" || code === "4100") return;

      const acc = accountMap.get(code);
      let type = acc ? acc.type.toLowerCase() : "";
      
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

    // Add COGS to expenses if non-zero
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
