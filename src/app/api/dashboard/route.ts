import { ok } from "@/lib/api";
import { getAllParties } from "@/lib/firestore/partiesRepository";
import { getAllInvoices } from "@/lib/firestore/invoicesRepository";
import { getAllItems } from "@/lib/firestore/itemsRepository";
import { 
  getAllCashReceipts, 
  getAllCashPayments, 
  getAllBankReceipts, 
  getAllBankPayments 
} from "@/lib/firestore/paymentsRepository";
import { getDocuments } from "@/lib/firestore/genericRepository";

function getDayStr(d: any): string {
  if (!d) return "";
  if (typeof d === "string") return d.slice(0, 10);
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return "";
    return dt.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date");
    const targetDateStr = dateParam ? dateParam.slice(0, 10) : new Date().toISOString().slice(0, 10);

    const [allParties, allInvoices, allCR, allCP, allBR, allBP, allItems] = await Promise.all([
      getAllParties(),
      getAllInvoices(),
      getAllCashReceipts(),
      getAllCashPayments(),
      getAllBankReceipts(),
      getAllBankPayments(),
      getAllItems()
    ]);

    const customers = allParties.filter((p: any) => p.type === "Customer");
    const vendors = allParties.filter((p: any) => p.type === "Vendor");
    const customerIds = new Set(customers.map((c: any) => String(c._id || c.id || "")));
    const vendorIds = new Set(vendors.map((v: any) => String(v._id || v.id || "")));

    const lowStockCount = allItems.filter((i: any) => {
      const qty = Number(i.stockQtyCartons) || Number(i.currentStock) || Number(i.stockQty) || 0;
      const reorder = i.reorderLevel || 0;
      return qty <= reorder;
    }).length;

    const getDailySummary = (dStr: string) => {
      const salesInvoices = allInvoices.filter((i: any) =>
        ["sale", "non_tax_sale", "challan", "pos", "pos_counter_sale", "tax_sale", "sale_invoice"].includes(i.type) &&
        getDayStr(i.date || i.createdAt) === dStr &&
        i.status !== "cancelled" && i.status !== "Cancelled"
      );
      const returnInvoices = allInvoices.filter((i: any) =>
        ["sale_return", "non_tax_sale_return", "pos_return"].includes(i.type) &&
        getDayStr(i.date || i.createdAt) === dStr &&
        i.status !== "cancelled" && i.status !== "Cancelled"
      );
      const purchaseInvoices = allInvoices.filter((i: any) =>
        ["purchase", "non_tax_purchase", "import_purchase", "tax_purchase", "purchase_invoice"].includes(i.type) &&
        getDayStr(i.date || i.createdAt) === dStr &&
        i.status !== "cancelled" && i.status !== "Cancelled"
      );
      const purchaseReturnInvoices = allInvoices.filter((i: any) =>
        ["purchase_return", "non_tax_purchase_return"].includes(i.type) &&
        getDayStr(i.date || i.createdAt) === dStr &&
        i.status !== "cancelled" && i.status !== "Cancelled"
      );

      const salesTotal = salesInvoices.reduce((s: number, i: any) => s + (Number(i.totalAmount) || 0), 0) -
                         returnInvoices.reduce((s: number, i: any) => s + (Number(i.totalAmount) || 0), 0);

      const purchasesTotal = purchaseInvoices.reduce((s: number, i: any) => s + (Number(i.totalAmount) || 0), 0) -
                             purchaseReturnInvoices.reduce((s: number, i: any) => s + (Number(i.totalAmount) || 0), 0);

      let recDebits = 0;
      let cashSalesPaid = 0;
      salesInvoices.forEach((i: any) => {
        const total = Number(i.totalAmount) || 0;
        const method = (i.paymentMethod || i.paymentTerms || "").toLowerCase();
        const isCredit = method.includes("credit") || i.isCreditBill || i.isOnCredit;
        let paidAtCreation = 0;
        if (isCredit) {
          paidAtCreation = Number(i.amountReceived) > 0 ? Number(i.amountReceived) : 0;
        } else {
          const isPaid = method === "cash" || method === "bank" || i.status === "paid" || i.balance === 0;
          paidAtCreation = isPaid ? total : ((Number(i.amountReceived) > 0 ? Number(i.amountReceived) : 0) || (Number(i.amountPaid) > 0 ? Number(i.amountPaid) : 0));
        }
        recDebits += Math.max(0, total - paidAtCreation);
        cashSalesPaid += Math.min(total, paidAtCreation);
      });

      allCP.forEach((p: any) => {
        const pid = String(p.partyId?._id || p.partyId || p.vendor || p.customer || "");
        if (customerIds.has(pid) && getDayStr(p.date || p.createdAt) === dStr && p.status !== "Cancelled") {
          recDebits += Number(p.amount) || 0;
        }
      });
      allBP.forEach((p: any) => {
        const pid = String(p.partyId?._id || p.partyId || p.vendor || p.customer || "");
        if (customerIds.has(pid) && getDayStr(p.date || p.createdAt) === dStr && p.status !== "Cancelled") {
          recDebits += Number(p.amount) || 0;
        }
      });

      let recCredits = 0;
      let vendorReceipts = 0;
      allCR.forEach((r: any) => {
        const pid = String(r.partyId?._id || r.partyId || r.party || "");
        if (customerIds.has(pid) && getDayStr(r.date || r.createdAt) === dStr && r.status !== "Cancelled") recCredits += Number(r.amount) || 0;
        if (vendorIds.has(pid) && getDayStr(r.date || r.createdAt) === dStr && r.status !== "Cancelled") vendorReceipts += Number(r.amount) || 0;
      });
      allBR.forEach((r: any) => {
        const pid = String(r.partyId?._id || r.partyId || r.party || "");
        if (customerIds.has(pid) && getDayStr(r.date || r.createdAt) === dStr && r.status !== "Cancelled") recCredits += Number(r.amount) || 0;
        if (vendorIds.has(pid) && getDayStr(r.date || r.createdAt) === dStr && r.status !== "Cancelled") vendorReceipts += Number(r.amount) || 0;
      });

      let creditPurchases = 0;
      let cashPurchasesPaid = 0;
      purchaseInvoices.forEach((i: any) => {
        const total = Number(i.totalAmount) || 0;
        const method = (i.paymentMethod || i.paymentTerms || "").toLowerCase();
        const isCredit = method.includes("credit") || i.isCreditBill || i.isOnCredit;
        let paidAtCreation = 0;
        if (isCredit) {
          paidAtCreation = Number(i.amountPaid) > 0 ? Number(i.amountPaid) : (Number(i.amountReceived) > 0 ? Number(i.amountReceived) : 0);
        } else {
          const isPaid = method === "cash" || method === "bank" || i.status === "paid" || i.balance === 0;
          paidAtCreation = isPaid ? total : ((Number(i.amountPaid) > 0 ? Number(i.amountPaid) : 0) || (Number(i.amountReceived) > 0 ? Number(i.amountReceived) : 0));
        }
        creditPurchases += Math.max(0, total - paidAtCreation);
        cashPurchasesPaid += Math.min(total, paidAtCreation);
      });

      let payDebits = 0;
      allCP.forEach((p: any) => {
        const pid = String(p.partyId?._id || p.partyId || p.vendor || "");
        if (vendorIds.has(pid) && getDayStr(p.date || p.createdAt) === dStr && p.status !== "Cancelled") payDebits += Number(p.amount) || 0;
      });
      allBP.forEach((p: any) => {
        const pid = String(p.vendor || p.partyId || "");
        if (vendorIds.has(pid) && getDayStr(p.date || p.createdAt) === dStr && p.status !== "Cancelled") payDebits += Number(p.amount) || 0;
      });

      let otherCashPayments = 0;
      allCP.forEach((p: any) => {
        const pid = String(p.partyId?._id || p.partyId || p.vendor || "");
        if (!vendorIds.has(pid) && getDayStr(p.date || p.createdAt) === dStr && p.status !== "Cancelled") otherCashPayments += Number(p.amount) || 0;
      });

      const cbReceipts = recCredits + cashSalesPaid + vendorReceipts;
      const cbPayments = payDebits + cashPurchasesPaid + otherCashPayments;

      return {
        salesToday: Math.round(salesTotal),
        salesCount: salesInvoices.length,
        purchasesToday: Math.round(purchasesTotal),
        purchasesCount: purchaseInvoices.length,
        recDebits: Math.round(recDebits),
        recCredits: Math.round(recCredits),
        payCredits: Math.round(creditPurchases + vendorReceipts),
        payDebits: Math.round(payDebits),
        cbReceipts: Math.round(cbReceipts),
        cbPayments: Math.round(cbPayments),
        expensesToday: Math.round(otherCashPayments)
      };
    };

    // Calculate opening balances dynamically from accounts, parties, and prior transactions
    const accounts = await getDocuments("accounts");
    const cashBankAccounts = accounts.filter((a: any) => 
      ["cash", "bank"].includes(String(a.type || "").toLowerCase()) ||
      ["1111", "1110"].includes(String(a.code || ""))
    );
    const initialCbOpening = cashBankAccounts.reduce((sum: number, a: any) => sum + (Number(a.openingBalance) || 0), 0);
    const initialRecOpening = customers.reduce((sum: number, c: any) => sum + (Number(c.openingBalance) || 0), 0);
    const initialPayOpening = vendors.reduce((sum: number, v: any) => sum + (Number(v.openingBalance) || 0), 0);

    let priorCbReceipts = 0;
    let priorCbPayments = 0;
    let priorRecDebits = 0;
    let priorRecCredits = 0;
    let priorPayCredits = 0;
    let priorPayDebits = 0;

    allInvoices.forEach((i: any) => {
      const dStr = getDayStr(i.date || i.createdAt);
      if (dStr && dStr < targetDateStr && i.status !== "cancelled" && i.status !== "Cancelled") {
        const total = Number(i.totalAmount) || 0;
        const method = (i.paymentMethod || i.paymentTerms || "").toLowerCase();
        const isCredit = method.includes("credit") || i.isCreditBill || i.isOnCredit;
        const paidAtCreation = isCredit ? (Number(i.amountReceived) || Number(i.amountPaid) || 0) : total;

        if (["sale", "non_tax_sale", "challan", "pos", "pos_counter_sale", "tax_sale", "sale_invoice"].includes(i.type)) {
          priorRecDebits += Math.max(0, total - paidAtCreation);
          priorCbReceipts += Math.min(total, paidAtCreation);
        } else if (["purchase", "non_tax_purchase", "import_purchase", "tax_purchase", "purchase_invoice"].includes(i.type)) {
          priorPayCredits += Math.max(0, total - paidAtCreation);
          priorCbPayments += Math.min(total, paidAtCreation);
        }
      }
    });

    allCR.forEach((r: any) => {
      const dStr = getDayStr(r.date || r.createdAt);
      if (dStr && dStr < targetDateStr && r.status !== "Cancelled") {
        const amt = Number(r.amount) || 0;
        const pid = String(r.partyId?._id || r.partyId || r.party || "");
        if (customerIds.has(pid)) priorRecCredits += amt;
        priorCbReceipts += amt;
      }
    });

    allBR.forEach((r: any) => {
      const dStr = getDayStr(r.date || r.createdAt);
      if (dStr && dStr < targetDateStr && r.status !== "Cancelled") {
        const amt = Number(r.amount) || 0;
        const pid = String(r.partyId?._id || r.partyId || r.party || "");
        if (customerIds.has(pid)) priorRecCredits += amt;
        priorCbReceipts += amt;
      }
    });

    allCP.forEach((p: any) => {
      const dStr = getDayStr(p.date || p.createdAt);
      if (dStr && dStr < targetDateStr && p.status !== "Cancelled") {
        const amt = Number(p.amount) || 0;
        const pid = String(p.partyId?._id || p.partyId || p.vendor || p.customer || "");
        if (customerIds.has(pid)) priorRecDebits += amt;
        if (vendorIds.has(pid)) priorPayDebits += amt;
        priorCbPayments += amt;
      }
    });

    allBP.forEach((p: any) => {
      const dStr = getDayStr(p.date || p.createdAt);
      if (dStr && dStr < targetDateStr && p.status !== "Cancelled") {
        const amt = Number(p.amount) || 0;
        const pid = String(p.partyId?._id || p.partyId || p.vendor || p.customer || "");
        if (customerIds.has(pid)) priorRecDebits += amt;
        if (vendorIds.has(pid)) priorPayDebits += amt;
        priorCbPayments += amt;
      }
    });

    const cbOpening = initialCbOpening + priorCbReceipts - priorCbPayments;
    const recOpening = initialRecOpening + priorRecDebits - priorRecCredits;
    const payOpening = initialPayOpening + priorPayCredits - priorPayDebits;

    const todaySum = getDailySummary(targetDateStr);

    const salesInvoicesAll = allInvoices.filter((i: any) =>
      ["sale", "non_tax_sale", "challan", "pos", "pos_counter_sale", "tax_sale", "sale_invoice"].includes(i.type) &&
      i.status !== "cancelled" && i.status !== "Cancelled"
    );
    const purchaseInvoicesAll = allInvoices.filter((i: any) =>
      ["purchase", "non_tax_purchase", "import_purchase", "tax_purchase", "purchase_invoice"].includes(i.type) &&
      i.status !== "cancelled" && i.status !== "Cancelled"
    );
    const saleReturnInvoicesAll = allInvoices.filter((i: any) =>
      ["sale_return", "non_tax_sale_return", "pos_return"].includes(i.type) &&
      i.status !== "cancelled" && i.status !== "Cancelled"
    );

    const totalSalesAll = Math.round(
      salesInvoicesAll.reduce((s: number, i: any) => s + (Number(i.totalAmount) || 0), 0) -
      saleReturnInvoicesAll.reduce((s: number, i: any) => s + (Number(i.totalAmount) || 0), 0)
    );
    const totalPurchasesAll = Math.round(
      purchaseInvoicesAll.reduce((s: number, i: any) => s + (Number(i.totalAmount) || 0), 0)
    );
    const totalExpensesAll = Math.round(
      allCP.filter((p: any) => !vendorIds.has(String(p.partyId?._id || p.partyId || p.vendor || "")))
           .reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0)
    );

    const totalStockValue = Math.round(allItems.reduce((s: number, i: any) => {
      const rate = Number(i.purchaseRate) || Number(i.ratePerCtn) || 0;
      const qty = Number(i.stockQtyCartons) || Number(i.currentStock) || Number(i.stockQty) || 0;
      return s + (qty * rate);
    }, 0));

    const totalCustomerReceivables = Math.round(customers.reduce((sum: number, c: any) => sum + Math.max(0, Number(c.balance) || 0), 0));
    const totalVendorPayables = Math.round(vendors.reduce((sum: number, v: any) => sum + Math.max(0, Number(v.balance) || 0), 0));

    const categoryMap: Record<string, number> = {};
    allItems.forEach((i: any) => {
      const cat = (i.categoryName || i.category || i.group || "Engine Oils").trim();
      const rate = Number(i.purchaseRate) || Number(i.ratePerCtn) || 0;
      const qty = Number(i.stockQtyCartons) || Number(i.currentStock) || Number(i.stockQty) || 0;
      categoryMap[cat] = (categoryMap[cat] || 0) + Math.round(qty * rate);
    });

    const categoryColors = ["#881337", "#be123c", "#e11d48", "#fb7185", "#9f1239", "#e11d48"];
    let categoryData = Object.entries(categoryMap)
      .filter(([_, v]) => v > 0)
      .map(([name, value], idx) => ({
        name,
        value,
        color: categoryColors[idx % categoryColors.length]
      })).sort((a, b) => b.value - a.value).slice(0, 6);

    // Pure dynamic product sales mapping
    const productSalesMap: Record<string, { name: string; qty: number; amount: number }> = {};
    salesInvoicesAll.forEach((inv: any) => {
      (inv.items || inv.lines || []).forEach((item: any) => {
        const key = String(item.itemId || item.name || item.description || "Product");
        const name = item.name || item.description || "Product";
        const qty = Number(item.cartons || item.qty || item.quantity || 1);
        const amt = Number(item.netAmount || item.amount || 0);
        if (!productSalesMap[key]) productSalesMap[key] = { name, qty: 0, amount: 0 };
        productSalesMap[key].qty += qty;
        productSalesMap[key].amount += amt;
      });
    });

    const topProducts = Object.values(productSalesMap)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
      .map((p) => ({
        name: p.name,
        qty: p.qty + " Qty",
        amount: "Rs." + Math.round(p.amount).toLocaleString(),
        trend: "+0%"
      }));

    const customerSalesMap: Record<string, { name: string; amount: number; orders: number }> = {};
    salesInvoicesAll.forEach((inv: any) => {
      const cName = inv.customerName || inv.partyName || (inv.partyId ? (inv.partyId.companyName || inv.partyId.name || String(inv.partyId)) : "Walk-in Customer");
      const amt = Number(inv.totalAmount || 0);
      if (!customerSalesMap[cName]) customerSalesMap[cName] = { name: cName, amount: 0, orders: 0 };
      customerSalesMap[cName].amount += amt;
      customerSalesMap[cName].orders += 1;
    });

    const topCustomers = Object.values(customerSalesMap)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
      .map((c) => ({
        name: c.name,
        type: "B2B",
        amount: "Rs." + Math.round(c.amount).toLocaleString(),
        orders: c.orders
      }));

    const now = new Date();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const flowData: { month: string; inflow: number; outflow: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mName = months[d.getMonth()];
      const mStr = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");

      const inflow = allCR.filter((r: any) => getDayStr(r.date || r.createdAt).startsWith(mStr))
                       .reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);
      const outflow = allCP.filter((p: any) => getDayStr(p.date || p.createdAt).startsWith(mStr))
                        .reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
      flowData.push({ month: mName, inflow: Math.round(inflow), outflow: Math.round(outflow) });
    }

    const currentCashBank = Math.round(cbOpening + todaySum.cbReceipts - todaySum.cbPayments);
    const currentReceivables = Math.round(recOpening + todaySum.recDebits - todaySum.recCredits);
    const currentPayables = Math.round(payOpening + todaySum.payCredits - todaySum.payDebits);
    const workingCapital = Math.round(currentCashBank + currentReceivables - currentPayables);

    const grossMarginPercent = totalSalesAll > 0 ? Number((((totalSalesAll - totalPurchasesAll) / totalSalesAll) * 100).toFixed(1)) : 0;
    const netMarginPercent = totalSalesAll > 0 ? Number((((totalSalesAll - totalPurchasesAll - totalExpensesAll) / totalSalesAll) * 100).toFixed(1)) : 0;
    const returnRate = salesInvoicesAll.length > 0 ? Number(((saleReturnInvoicesAll.length / salesInvoicesAll.length) * 100).toFixed(1)) : 0;

    return ok({
      salesToday: todaySum.salesToday,
      salesCountToday: todaySum.salesCount,
      purchasesToday: todaySum.purchasesToday,
      purchasesCountToday: todaySum.purchasesCount,
      expensesToday: todaySum.expensesToday,

      totalSales: totalSalesAll,
      salesCount: salesInvoicesAll.length,
      totalPurchases: totalPurchasesAll,
      purchaseCount: purchaseInvoicesAll.length,
      totalExpenses: totalExpensesAll,
      totalStockValue: totalStockValue,
      totalItemCount: allItems.length,
      totalCustomersCount: customers.length,
      totalVendorsCount: vendors.length,
      totalCustomerReceivables: totalCustomerReceivables,
      totalVendorPayables: totalVendorPayables,
      lowStockCount: lowStockCount,

      cashBank: {
        opening: Math.round(cbOpening),
        receipts: todaySum.cbReceipts,
        payments: todaySum.cbPayments,
        current: currentCashBank
      },
      receivables: {
        opening: Math.round(recOpening),
        sales: todaySum.recDebits,
        receipts: todaySum.recCredits,
        current: currentReceivables
      },
      payables: {
        opening: Math.round(payOpening),
        purchases: todaySum.payCredits,
        payments: todaySum.payDebits,
        current: currentPayables
      },

      workingCapital,
      grossMarginPercent,
      netMarginPercent,
      returnRate,
      categoryData,
      topProducts,
      topCustomers,
      flowData
    });

  } catch (error: any) {
    console.error("Dashboard API Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
