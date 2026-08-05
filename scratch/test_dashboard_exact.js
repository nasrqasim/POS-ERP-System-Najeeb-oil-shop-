import mongoose from "mongoose";

const MONGODB_URI = "mongodb+srv://oilshop:Oil%233421@cluster0.68vjmln.mongodb.net/pos_system_db?retryWrites=true&w=majority";

async function main() {
  await mongoose.connect(MONGODB_URI);

  const db = mongoose.connection.db;

  // We test for dateParam = "2026-08-01"
  const dateStr = "2026-08-01";
  const targetDate = new Date(dateStr);
  const startOfDay = new Date(dateStr + "T00:00:00.000Z");
  const endOfDay = new Date(dateStr + "T23:59:59.999Z");

  function getDayStr(d) {
    if (!d) return "";
    const dateObj = new Date(d);
    if (isNaN(dateObj.getTime())) return "";
    return dateObj.toISOString().slice(0, 10);
  }

  const allParties = await db.collection("parties").find({ status: "Active" }).toArray();
  const activeCustomers = allParties.filter(p => p.type === "Customer");
  const activeVendors = allParties.filter(p => p.type === "Vendor");

  const customerIds = new Set(activeCustomers.map(c => String(c._id)));
  const vendorIds = new Set(activeVendors.map(v => String(v._id)));

  const allInvoices = await db.collection("invoices").find({ status: { $ne: "cancelled" } }).toArray();
  const allCR = await db.collection("cashreceipts").find({}).toArray();
  const allBR = await db.collection("bankreceipts").find({}).toArray();
  const allCP = await db.collection("cashpayments").find({}).toArray();
  const allBP = await db.collection("bankpayments").find({}).toArray();

  // 1. Sales today
  const salesInvoicesToday = allInvoices.filter(i => 
    ["sale", "non_tax_sale", "challan", "pos"].includes(i.type) && getDayStr(i.date || i.createdAt) === dateStr
  );
  const salesToday = salesInvoicesToday.reduce((s, i) => s + (Number(i.totalAmount) || 0), 0);

  // 2. Receivables (Customers)
  // Debits Today: Credit sales (where invoice balance/unpaid > 0 or totalAmount - cashReceived)
  let recSalesDebitsToday = 0;
  salesInvoicesToday.forEach(i => {
    const total = Number(i.totalAmount) || 0;
    const isPaid = i.paymentMethod === "Cash" || i.paymentMethod === "Bank" || i.status === "paid" || i.balance === 0;
    const paidAtCreation = isPaid ? total : ((Number(i.amountReceived) > 0 ? Number(i.amountReceived) : 0) || (Number(i.amountPaid) > 0 ? Number(i.amountPaid) : 0));
    const creditPortion = Math.max(0, total - paidAtCreation);
    recSalesDebitsToday += creditPortion;
  });

  // Credits Today: Receipts from customers today
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

  // Customer Opening balance prior to dateStr
  // Dynamic per customer opening + prior sales debits - prior receipts
  let customerOpeningTotal = activeCustomers.reduce((s, c) => s + (Number(c.openingBalance) || 0), 0);
  allInvoices.forEach(i => {
    const dStr = getDayStr(i.date || i.createdAt);
    if (dStr < dateStr) {
      if (["sale", "non_tax_sale", "challan", "pos"].includes(i.type)) {
        const total = Number(i.totalAmount) || 0;
        const isPaid = i.paymentMethod === "Cash" || i.paymentMethod === "Bank" || i.status === "paid" || i.balance === 0;
        const paidAtCreation = isPaid ? total : ((Number(i.amountReceived) > 0 ? Number(i.amountReceived) : 0) || (Number(i.amountPaid) > 0 ? Number(i.amountPaid) : 0));
        customerOpeningTotal += Math.max(0, total - paidAtCreation);
      } else if (["sale_return", "non_tax_sale_return"].includes(i.type)) {
        customerOpeningTotal -= Number(i.totalAmount) || 0;
      }
    }
  });
  allCR.forEach(r => {
    const pid = String(r.partyId?._id || r.partyId || r.party || "");
    if (customerIds.has(pid) && getDayStr(r.date || r.createdAt) < dateStr) {
      customerOpeningTotal -= Number(r.amount) || 0;
    }
  });
  allBR.forEach(r => {
    const pid = String(r.partyId?._id || r.partyId || r.party || "");
    if (customerIds.has(pid) && getDayStr(r.date || r.createdAt) < dateStr) {
      customerOpeningTotal -= Number(r.amount) || 0;
    }
  });

  const recCurrent = customerOpeningTotal + recSalesDebitsToday - recReceiptsCreditsToday;

  // 3. Payables (Vendors)
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
  // Also check paid at creation for purchases today
  purchaseInvoicesToday.forEach(i => {
    const total = Number(i.totalAmount) || 0;
    const rawPaid = (Number(i.amountReceived) > 0 ? Number(i.amountReceived) : 0) ||
                    (Number(i.amountPaid) > 0 ? Number(i.amountPaid) : 0) ||
                    ((i.paymentMethod === "Cash" || i.paymentMethod === "Bank" || i.status === "paid" || i.balance === 0) ? total : 0);
    // If CP/BP entry was created for this, avoid double count by maxing or checking reference
    if (rawPaid > 0 && payPaymentsDebitsToday === 0) {
      payPaymentsDebitsToday += rawPaid;
    }
  });

  let vendorOpeningTotal = activeVendors.reduce((s, v) => s + (Number(v.openingBalance) || 0), 0);
  allInvoices.forEach(i => {
    const dStr = getDayStr(i.date || i.createdAt);
    if (dStr < dateStr) {
      if (["purchase", "non_tax_purchase", "import_purchase"].includes(i.type)) {
        vendorOpeningTotal += Number(i.totalAmount) || 0;
      } else if (["purchase_return", "non_tax_purchase_return"].includes(i.type)) {
        vendorOpeningTotal -= Number(i.totalAmount) || 0;
      }
    }
  });
  allCP.forEach(p => {
    const pid = String(p.partyId?._id || p.partyId || p.vendor || "");
    if (vendorIds.has(pid) && getDayStr(p.date || p.createdAt) < dateStr) {
      vendorOpeningTotal -= Number(p.amount) || 0;
    }
  });
  allBP.forEach(p => {
    const pid = String(p.vendor || p.partyId || "");
    if (vendorIds.has(pid) && getDayStr(p.date || p.createdAt) < dateStr) {
      vendorOpeningTotal -= Number(p.amount) || 0;
    }
  });

  const payCurrent = vendorOpeningTotal + payPurchasesCreditsToday - payPaymentsDebitsToday;

  console.log("=== RESULTS FOR 2026-08-01 ===");
  console.log("Sales Today:", salesToday);
  console.log("Receivables -> Opening:", customerOpeningTotal, "| Sales (Debits):", recSalesDebitsToday, "| Receipts (Credits):", recReceiptsCreditsToday, "| Current:", recCurrent);
  console.log("Payables -> Opening:", vendorOpeningTotal, "| Purchases (Credits):", payPurchasesCreditsToday, "| Payments (Debits):", payPaymentsDebitsToday, "| Current:", payCurrent);

  await mongoose.disconnect();
}

main().catch(console.error);
