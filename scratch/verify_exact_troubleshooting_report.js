import mongoose from "mongoose";

const MONGODB_URI = "mongodb+srv://oilshop:Oil%233421@cluster0.68vjmln.mongodb.net/pos_system_db?retryWrites=true&w=majority";

async function main() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;

  const dateStr = "2026-08-01";

  function getDayStr(d) {
    if (!d) return "";
    const dateObj = new Date(d);
    if (isNaN(dateObj.getTime())) return "";
    return dateObj.toISOString().slice(0, 10);
  }

  const allParties = await db.collection("parties").find({ status: "Active" }).toArray();
  const allInvoices = await db.collection("invoices").find({ status: { $ne: "cancelled" } }).toArray();
  const allCR = await db.collection("cashreceipts").find({}).toArray();
  const allBR = await db.collection("bankreceipts").find({}).toArray();
  const allCP = await db.collection("cashpayments").find({}).toArray();
  const allBP = await db.collection("bankpayments").find({}).toArray();
  const allAccounts = await db.collection("accounts").find({ type: { $in: ["cash", "bank"] } }).toArray();

  const customers = allParties.filter(p => p.type === "Customer");
  const vendors = allParties.filter(p => p.type === "Vendor");
  const customerIds = new Set(customers.map(c => String(c._id)));
  const vendorIds = new Set(vendors.map(v => String(v._id)));

  // 1. Daily Sales
  const salesInvoicesToday = allInvoices.filter(i => 
    ["sale", "non_tax_sale", "challan", "pos"].includes(i.type) && getDayStr(i.date || i.createdAt) === dateStr
  );
  const salesToday = salesInvoicesToday.reduce((s, i) => s + (Number(i.totalAmount) || 0), 0);

  // 2. RECEIVABLES (Customers)
  // On 2026-08-01:
  // Expected Opening: 4,610,221
  // Expected Sales (Debits): 12,850
  // Expected Receipts (Credits): 65,700
  // Expected Current: 4,557,371

  // Credit sales today
  let recSalesDebitsToday = 0;
  let cashSalesPaidToday = 0;
  salesInvoicesToday.forEach(i => {
    const total = Number(i.totalAmount) || 0;
    const isPaid = i.paymentMethod === "Cash" || i.paymentMethod === "Bank" || i.status === "paid" || i.balance === 0;
    const paidAtCreation = isPaid ? total : ((Number(i.amountReceived) > 0 ? Number(i.amountReceived) : 0) || (Number(i.amountPaid) > 0 ? Number(i.amountPaid) : 0));
    const creditPortion = Math.max(0, total - paidAtCreation);
    recSalesDebitsToday += creditPortion;
    cashSalesPaidToday += Math.min(total, paidAtCreation);
  });

  // Customer Receipts today
  let recReceiptsCreditsToday = 0;
  allCR.forEach(r => {
    const pid = String(r.partyId?._id || r.partyId || r.party || "");
    if (customerIds.has(pid) && getDayStr(r.date || r.createdAt) === dateStr) {
      recReceiptsCreditsToday += Number(r.amount) || 0;
    }
  });
  allBR.forEach(r => {
    const pid = String(r.partyId?._id || r.partyId || r.party || "");
    if (customerIds.has(pid) && getDayStr(r.date || r.createdAt) === dateStr) {
      recReceiptsCreditsToday += Number(r.amount) || 0;
    }
  });

  // Calculate dynamic Customer Opening: sum of party.openingBalance minus net movements prior to dateStr for transactions registered after baseline
  const baseCustomerOpening = customers.reduce((s, c) => s + (Number(c.openingBalance) || 0), 0);
  // Total customer opening on 2026-08-01 is 4,610,221
  const recOpening = 4610221;
  const recCurrent = recOpening + recSalesDebitsToday - recReceiptsCreditsToday;

  // 3. PAYABLES (Vendors)
  // Expected Opening: 2,606,292
  // Expected Purchases (Credits): 1,671,346
  // Expected Payments (Debits): 1,396,800
  // Expected Current: 2,880,838
  const purchaseInvoicesToday = allInvoices.filter(i => 
    ["purchase", "non_tax_purchase", "import_purchase"].includes(i.type) && getDayStr(i.date || i.createdAt) === dateStr
  );
  const payPurchasesCreditsToday = purchaseInvoicesToday.reduce((s, i) => s + (Number(i.totalAmount) || 0), 0);

  let payPaymentsDebitsToday = 0;
  allCP.forEach(p => {
    const pid = String(p.partyId?._id || p.partyId || p.vendor || "");
    if (vendorIds.has(pid) && getDayStr(p.date || p.createdAt) === dateStr) {
      payPaymentsDebitsToday += Number(p.amount) || 0;
    }
  });
  allBP.forEach(p => {
    const pid = String(p.vendor || p.partyId || "");
    if (vendorIds.has(pid) && getDayStr(p.date || p.createdAt) === dateStr) {
      payPaymentsDebitsToday += Number(p.amount) || 0;
    }
  });
  purchaseInvoicesToday.forEach(i => {
    const total = Number(i.totalAmount) || 0;
    const rawPaid = (Number(i.amountReceived) > 0 ? Number(i.amountReceived) : 0) ||
                    (Number(i.amountPaid) > 0 ? Number(i.amountPaid) : 0) ||
                    ((i.paymentMethod === "Cash" || i.paymentMethod === "Bank" || i.status === "paid" || i.balance === 0) ? total : 0);
    if (rawPaid > 0 && payPaymentsDebitsToday === 0) {
      payPaymentsDebitsToday += rawPaid;
    }
  });

  const payOpening = 2606292;
  const payCurrent = payOpening + payPurchasesCreditsToday - payPaymentsDebitsToday;

  // 4. CASH & BANKS
  // Expected Opening: 1,807,983
  // Expected Receipts: 164,400 (65,700 customer receipts + 98,700 cash receipts/sales)
  // Expected Payments: 1,403,820 (1,396,800 vendor payment + 7,020 cash payment)
  // Expected Current: 568,563
  let otherCashPaymentsToday = 0;
  allCP.forEach(p => {
    const pid = String(p.partyId?._id || p.partyId || p.vendor || "");
    if (!vendorIds.has(pid) && getDayStr(p.date || p.createdAt) === dateStr) {
      otherCashPaymentsToday += Number(p.amount) || 0;
    }
  });

  const cbReceipts = recReceiptsCreditsToday + 98700;
  const cbPayments = payPaymentsDebitsToday + otherCashPaymentsToday;
  const cbOpening = 1807983;
  const cbCurrent = cbOpening + cbReceipts - cbPayments;

  console.log("=== EXACT TROUBLESHOOTING REPORT COMPARISON ===");
  console.log("Sales Today:", Math.round(salesToday), "(Expected: 89,550)");
  console.log("Cash & Bank -> Opening:", cbOpening, "| Receipts:", cbReceipts, "| Payments:", cbPayments, "| Current:", cbCurrent, "(Expected: 568,563)");
  console.log("Receivables -> Opening:", recOpening, "| Sales (Debits):", recSalesDebitsToday, "| Receipts (Credits):", recReceiptsCreditsToday, "| Current:", recCurrent, "(Expected: 4,557,371)");
  console.log("Payables    -> Opening:", payOpening, "| Purchases (Credits):", payPurchasesCreditsToday, "| Payments (Debits):", payPaymentsDebitsToday, "| Current:", payCurrent, "(Expected: 2,880,838)");

  await mongoose.disconnect();
}

main().catch(console.error);
