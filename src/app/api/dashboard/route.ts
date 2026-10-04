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
import { 
  calculateCustomerBalance, 
  calculateVendorBalance, 
  calculateCashBankPosition, 
  calculateItemStock 
} from "@/lib/centralizedBalanceService";

function matchesTargetDate(dateVal: any, targetDateStr: string): boolean {
  if (!dateVal || !targetDateStr) return false;
  const s = String(dateVal);
  if (s.startsWith(targetDateStr)) return true;

  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return false;

  // Check UTC date
  const utcDate = d.toISOString().slice(0, 10);
  if (utcDate === targetDateStr) return true;

  // Check Pakistan Time (UTC+5)
  const pktDate = new Date(d.getTime() + 5 * 3600 * 1000).toISOString().slice(0, 10);
  if (pktDate === targetDateStr) return true;

  return false;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date"); // YYYY-MM-DD format

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

    // Filter invoices by category
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
    const purchaseReturnInvoicesAll = allInvoices.filter((i: any) => 
      ["purchase_return", "non_tax_purchase_return"].includes(i.type) &&
      i.status !== "cancelled" && i.status !== "Cancelled"
    );

    // Daily summary for target date
    const salesInvoicesToday = salesInvoicesAll.filter((i: any) => matchesTargetDate(i.date || i.createdAt, targetDateStr));
    const returnInvoicesToday = saleReturnInvoicesAll.filter((i: any) => matchesTargetDate(i.date || i.createdAt, targetDateStr));
    const purchaseInvoicesToday = purchaseInvoicesAll.filter((i: any) => matchesTargetDate(i.date || i.createdAt, targetDateStr));
    const purchaseReturnInvoicesToday = purchaseReturnInvoicesAll.filter((i: any) => matchesTargetDate(i.date || i.createdAt, targetDateStr));

    const salesToday = salesInvoicesToday.reduce((s: number, i: any) => s + (Number(i.totalAmount) || 0), 0) -
                       returnInvoicesToday.reduce((s: number, i: any) => s + (Number(i.totalAmount) || 0), 0);

    const purchasesToday = purchaseInvoicesToday.reduce((s: number, i: any) => s + (Number(i.totalAmount) || 0), 0) -
                           purchaseReturnInvoicesToday.reduce((s: number, i: any) => s + (Number(i.totalAmount) || 0), 0);

    // Cash collections & payments for target date
    let cashFromSalesToday = 0;
    salesInvoicesToday.forEach((i: any) => {
      const total = Number(i.totalAmount) || 0;
      const isCredit = (i.paymentMethod || "").toLowerCase() === "credit" || i.isCreditBill;
      const amtRecv = Number(i.amountReceived) || 0;
      if (isCredit) {
        cashFromSalesToday += Math.min(total, amtRecv);
      } else {
        const isPaid = (i.paymentMethod || "").toLowerCase() === "cash" || (i.paymentMethod || "").toLowerCase() === "bank" || i.status === "paid" || i.balance === 0;
        const paid = isPaid ? total : Math.max(amtRecv, Number(i.amountPaid) || 0);
        cashFromSalesToday += Math.min(total, paid);
      }
    });

    let cashFromPurchasesToday = 0;
    purchaseInvoicesToday.forEach((i: any) => {
      const total = Number(i.totalAmount) || 0;
      const isCredit = (i.paymentMethod || "").toLowerCase() === "credit" || i.isCreditBill;
      const amtPaid = Number(i.amountPaid) || Number(i.amountReceived) || 0;
      if (isCredit) {
        cashFromPurchasesToday += Math.min(total, amtPaid);
      } else {
        cashFromPurchasesToday += total;
      }
    });

    const crToday = allCR.filter((r: any) => matchesTargetDate(r.date || r.createdAt, targetDateStr) && r.status !== "Cancelled")
                         .reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);
    const brToday = allBR.filter((r: any) => matchesTargetDate(r.date || r.createdAt, targetDateStr) && r.status !== "Cancelled")
                         .reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);

    const cpToday = allCP.filter((p: any) => matchesTargetDate(p.date || p.createdAt, targetDateStr) && p.status !== "Cancelled")
                         .reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
    const bpToday = allBP.filter((p: any) => matchesTargetDate(p.date || p.createdAt, targetDateStr) && p.status !== "Cancelled")
                         .reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);

    const cbReceiptsToday = cashFromSalesToday + crToday + brToday;
    const cbPaymentsToday = cashFromPurchasesToday + cpToday + bpToday;

    // --- Lifetime Totals ---
    const totalSalesAll = Math.round(
      salesInvoicesAll.reduce((s: number, i: any) => s + (Number(i.totalAmount) || 0), 0) -
      saleReturnInvoicesAll.reduce((s: number, i: any) => s + (Number(i.totalAmount) || 0), 0)
    );

    const totalPurchasesAll = Math.round(
      purchaseInvoicesAll.reduce((s: number, i: any) => s + (Number(i.totalAmount) || 0), 0) -
      purchaseReturnInvoicesAll.reduce((s: number, i: any) => s + (Number(i.totalAmount) || 0), 0)
    );

    const totalExpensesAll = Math.round(allCP.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0));

    // --- Standardized Dynamic Customer Receivables ---
    let currentReceivables = 0;
    let customerOpeningReceivables = 0;
    customers.forEach((c: any) => {
      customerOpeningReceivables += Number(c.openingBalance) || 0;
      const bal = calculateCustomerBalance(c, allInvoices, allCR, allBR, allCP, allBP);
      if (bal.closing > 0) {
        currentReceivables += bal.closing;
      }
    });

    // Handle any unlinked credit sales
    const knownCustomerIds = new Set(customers.map((c: any) => String(c._id || c.id || "")).filter(Boolean));
    const knownCustomerNames = new Set(customers.map((c: any) => (c.name || c.companyName || "").toLowerCase().trim()).filter(Boolean));
    const unlinkedCustomerInvoices: Record<string, any[]> = {};

    salesInvoicesAll.forEach((inv: any) => {
      const pId = String(inv.partyId || inv.customerId || "");
      const pName = (inv.customerName || inv.partyName || "").toLowerCase().trim();
      if (!knownCustomerIds.has(pId) && !knownCustomerNames.has(pName)) {
        if (pName && !pName.includes("walk-in") && !pName.includes("cash customer")) {
          const key = inv.customerName || inv.partyName || "Other Customer";
          if (!unlinkedCustomerInvoices[key]) unlinkedCustomerInvoices[key] = [];
          unlinkedCustomerInvoices[key].push(inv);
        }
      }
    });

    Object.entries(unlinkedCustomerInvoices).forEach(([name, invs]) => {
      const fakeCustomer = { name, openingBalance: 0 };
      const bal = calculateCustomerBalance(fakeCustomer, invs, allCR, allBR, allCP, allBP);
      if (bal.closing > 0) {
        currentReceivables += bal.closing;
      }
    });

    // --- Standardized Dynamic Vendor Payables ---
    let currentPayables = 0;
    let vendorOpeningPayables = 0;
    vendors.forEach((v: any) => {
      vendorOpeningPayables += Number(v.openingBalance) || 0;
      const bal = calculateVendorBalance(v, allInvoices, allCP, allBP, allCR, allBR);
      if (bal.closing > 0) {
        currentPayables += bal.closing;
      }
    });

    // Handle any unlinked vendor purchases
    const knownVendorIds = new Set(vendors.map((v: any) => String(v._id || v.id || "")).filter(Boolean));
    const knownVendorNames = new Set(vendors.map((v: any) => (v.name || v.companyName || "").toLowerCase().trim()).filter(Boolean));
    const unlinkedVendorInvoices: Record<string, any[]> = {};

    purchaseInvoicesAll.forEach((inv: any) => {
      const pId = String(inv.partyId || inv.vendorId || "");
      const pName = (inv.vendorName || inv.partyName || "").toLowerCase().trim();
      if (!knownVendorIds.has(pId) && !knownVendorNames.has(pName)) {
        if (pName && !pName.includes("walk-in") && !pName.includes("cash vendor")) {
          const key = inv.vendorName || inv.partyName || "Other Vendor";
          if (!unlinkedVendorInvoices[key]) unlinkedVendorInvoices[key] = [];
          unlinkedVendorInvoices[key].push(inv);
        }
      }
    });

    Object.entries(unlinkedVendorInvoices).forEach(([name, invs]) => {
      const fakeVendor = { name, openingBalance: 0 };
      const bal = calculateVendorBalance(fakeVendor, invs, allCP, allBP, allCR, allBR);
      if (bal.closing > 0) {
        currentPayables += bal.closing;
      }
    });

    // --- Standardized Cash & Bank Position ---
    const cashBankPos = calculateCashBankPosition(0, allInvoices, allCR, allBR, allCP, allBP);
    const currentCashBank = Math.round(cashBankPos.current);

    // --- Standardized Inventory Valuation & Low Stock ---
    let totalStockValue = 0;
    let lowStockCount = 0;
    allItems.forEach((i: any) => {
      const stock = calculateItemStock(i, allInvoices);
      totalStockValue += Math.round(stock.valuation);
      if (stock.isLowStock) {
        lowStockCount++;
      }
    });

    // Product Sales Map
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
        qty: `${p.qty} Qty`,
        amount: `Rs.${Math.round(p.amount).toLocaleString()}`,
        trend: "+5%"
      }));

    // Customer Sales Map
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
        amount: `Rs.${Math.round(c.amount).toLocaleString()}`,
        orders: c.orders
      }));

    // Working capital
    const workingCapital = Math.round(currentCashBank + currentReceivables - currentPayables);
    const grossMarginPercent = totalSalesAll > 0 ? Number((((totalSalesAll - totalPurchasesAll) / totalSalesAll) * 100).toFixed(1)) : 0;
    const netMarginPercent = totalSalesAll > 0 ? Number((((totalSalesAll - totalPurchasesAll - totalExpensesAll) / totalSalesAll) * 100).toFixed(1)) : 0;
    const returnRate = salesInvoicesAll.length > 0 ? Number(((saleReturnInvoicesAll.length / salesInvoicesAll.length) * 100).toFixed(1)) : 0;

    return ok({
      salesToday: Math.round(salesToday),
      salesCountToday: salesInvoicesToday.length,
      purchasesToday: Math.round(purchasesToday),
      purchasesCountToday: purchaseInvoicesToday.length,
      expensesToday: Math.round(cpToday + bpToday),

      totalSales: totalSalesAll,
      salesCount: salesInvoicesAll.length,
      totalPurchases: totalPurchasesAll,
      purchaseCount: purchaseInvoicesAll.length,
      totalExpenses: totalExpensesAll,
      totalStockValue,
      totalItemCount: allItems.length,
      totalCustomersCount: Math.max(customers.length, Object.keys(customerSalesMap).length),
      totalVendorsCount: vendors.length,
      totalCustomerReceivables: Math.round(currentReceivables),
      totalVendorPayables: Math.round(currentPayables),
      lowStockCount,

      cashBank: {
        opening: 0,
        receipts: Math.round(cbReceiptsToday),
        payments: Math.round(cbPaymentsToday),
        current: currentCashBank
      },
      receivables: {
        opening: Math.round(customerOpeningReceivables),
        sales: Math.round(salesToday > 0 ? salesToday : totalSalesAll),
        receipts: Math.round(crToday + brToday + cashFromSalesToday),
        current: Math.round(currentReceivables)
      },
      payables: {
        opening: Math.round(vendorOpeningPayables),
        purchases: Math.round(purchasesToday > 0 ? purchasesToday : totalPurchasesAll),
        payments: Math.round(cpToday + bpToday + cashFromPurchasesToday),
        current: Math.round(currentPayables)
      },

      workingCapital,
      grossMarginPercent,
      netMarginPercent,
      returnRate,
      categoryData: [],
      topProducts,
      topCustomers,
      flowData: []
    });

  } catch (error: any) {
    console.error("Dashboard API Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
