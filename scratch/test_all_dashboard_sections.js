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

  // 1. Sales today
  const salesInvoicesToday = allInvoices.filter(i => 
    ["sale", "non_tax_sale", "challan", "pos"].includes(i.type) && getDayStr(i.date || i.createdAt) === dateStr
  );
  const salesToday = salesInvoicesToday.reduce((s, i) => s + (Number(i.totalAmount) || 0), 0);

  // 2. CASH & BANK
  const initialCashBankOpening = allAccounts.reduce((s, a) => s + (Number(a.openingBalance) || 0), 0);
  let cbRecBefore = 0, cbRecToday = 0;
  let cbPayBefore = 0, cbPayToday = 0;

  allCR.forEach(r => {
    const dStr = getDayStr(r.date || r.createdAt);
    const amt = Number(r.amount) || 0;
    if (dStr < dateStr) cbRecBefore += amt;
    else if (dStr === dateStr) cbRecToday += amt;
  });
  allBR.forEach(r => {
    const dStr = getDayStr(r.date || r.createdAt);
    const amt = Number(r.amount) || 0;
    if (dStr < dateStr) cbRecBefore += amt;
    else if (dStr === dateStr) cbRecToday += amt;
  });
  allCP.forEach(p => {
    const dStr = getDayStr(p.date || p.createdAt);
    const amt = Number(p.amount) || 0;
    if (dStr < dateStr) cbPayBefore += amt;
    else if (dStr === dateStr) cbPayToday += amt;
  });
  allBP.forEach(p => {
    const dStr = getDayStr(p.date || p.createdAt);
    const amt = Number(p.amount) || 0;
    if (dStr < dateStr) cbPayBefore += amt;
    else if (dStr === dateStr) cbPayToday += amt;
  });

  const cbOpening = Math.round(initialCashBankOpening + cbRecBefore - cbPayBefore);
  const cbReceipts = Math.round(cbRecToday);
  const cbPayments = Math.round(cbPayToday);
  const cbCurrent = cbOpening + cbReceipts - cbPayments;

  // 3. RECEIVABLES (Customers)
  const customers = allParties.filter(p => p.type === "Customer");
  let custOpeningTotal = 0;
  let custSalesToday = 0;
  let custReceiptsToday = 0;
  let custClosingTotal = 0;

  customers.forEach(p => {
    const partyId = p._id;
    const initialOpening = Math.abs(Number(p.openingBalance) || 0);

    const pInvoices = allInvoices.filter(inv => String(inv.partyId?._id || inv.partyId) === String(partyId));
    const pCashReceipts = allCR.filter(r => String(r.partyId?._id || r.partyId || r.party) === String(partyId));
    const pBankReceipts = allBR.filter(r => String(r.partyId?._id || r.partyId || r.party) === String(partyId));

    const txs = [];

    pInvoices.forEach(s => {
      const isReturn = s.type === "sale_return" || s.type === "non_tax_sale_return";
      if (["sale", "non_tax_sale", "challan", "pos", "sale_return", "non_tax_sale_return"].includes(s.type)) {
        const totalAmt = Number(s.totalAmount) || 0;
        let paidAtCreation = 0;
        if (!isReturn) {
          const invNo = s.invoiceNo || "";
          const linkedCashAmt = invNo ? pCashReceipts
            .filter(r => r.reference === invNo || (r.remarks && r.remarks.toLowerCase().includes(invNo.toLowerCase())))
            .reduce((sum, r) => sum + (Number(r.amount) || 0), 0) : 0;
          const linkedBankAmt = invNo ? pBankReceipts
            .filter(r => r.instrumentNo === invNo || (r.instrumentNo && r.instrumentNo.toLowerCase().includes(invNo.toLowerCase())))
            .reduce((sum, r) => sum + (Number(r.amount) || 0), 0) : 0;

          const rawPaid = (Number(s.amountReceived) > 0 ? Number(s.amountReceived) : 0) ||
                          (Number(s.amountPaid) > 0 ? Number(s.amountPaid) : 0) ||
                          ((s.paymentMethod === "Cash" || s.paymentMethod === "Bank" || s.status === "paid" || s.balance === 0) ? totalAmt : 0);

          paidAtCreation = Math.max(0, rawPaid - (linkedCashAmt + linkedBankAmt));
        }

        txs.push({
          date: new Date(s.date || s.createdAt),
          debit: isReturn ? 0 : totalAmt,
          credit: isReturn ? totalAmt : paidAtCreation
        });
      }
    });

    pCashReceipts.forEach(r => txs.push({ date: new Date(r.date || r.createdAt), debit: 0, credit: Number(r.amount) || 0 }));
    pBankReceipts.forEach(r => txs.push({ date: new Date(r.date || r.createdAt), debit: 0, credit: Number(r.amount) || 0 }));

    let opening = initialOpening;
    let debitsToday = 0;
    let creditsToday = 0;

    txs.forEach(t => {
      const dStr = getDayStr(t.date);
      if (dStr < dateStr) {
        opening += t.debit - t.credit;
      } else if (dStr === dateStr) {
        debitsToday += t.debit;
        creditsToday += t.credit;
      }
    });

    custOpeningTotal += opening;
    custSalesToday += debitsToday;
    custReceiptsToday += creditsToday;
    custClosingTotal += (opening + debitsToday - creditsToday);
  });

  // 4. PAYABLES (Vendors)
  const vendors = allParties.filter(p => p.type === "Vendor");
  let vendorOpeningTotal = 0;
  let vendorPurchasesToday = 0;
  let vendorPaymentsToday = 0;
  let vendorClosingTotal = 0;

  vendors.forEach(p => {
    const partyId = p._id;
    const initialOpening = Number(p.openingBalance) || 0;

    const pInvoices = allInvoices.filter(inv => String(inv.partyId?._id || inv.partyId) === String(partyId));
    const pCashPayments = allCP.filter(py => String(py.partyId?._id || py.partyId || py.vendor) === String(partyId));
    const pBankPayments = allBP.filter(py => String(py.vendor || py.partyId) === String(partyId));
    const pCashReceipts = allCR.filter(r => String(r.partyId?._id || r.partyId || r.party) === String(partyId));
    const pBankReceipts = allBR.filter(r => String(r.partyId?._id || r.partyId || r.party) === String(partyId));

    const txs = [];

    pInvoices.forEach(s => {
      const isReturn = s.type === "purchase_return" || s.type === "non_tax_purchase_return";
      if (["purchase", "non_tax_purchase", "import_purchase", "purchase_return", "non_tax_purchase_return"].includes(s.type)) {
        const totalAmt = Number(s.totalAmount) || 0;
        let paidAtCreation = 0;
        if (!isReturn) {
          const invNo = s.invoiceNo || "";
          const linkedCashAmt = invNo ? pCashPayments
            .filter(py => py.reference === invNo || (py.narration && py.narration.toLowerCase().includes(invNo.toLowerCase())))
            .reduce((sum, py) => sum + (Number(py.amount) || 0), 0) : 0;
          const linkedBankAmt = invNo ? pBankPayments
            .filter(py => py.instrumentNo === invNo || (py.instrumentNo && py.instrumentNo.toLowerCase().includes(invNo.toLowerCase())))
            .reduce((sum, py) => sum + (Number(py.amount) || 0), 0) : 0;

          const rawPaid = (Number(s.amountReceived) > 0 ? Number(s.amountReceived) : 0) ||
                          (Number(s.amountPaid) > 0 ? Number(s.amountPaid) : 0) ||
                          ((s.paymentMethod === "Cash" || s.paymentMethod === "Bank" || s.status === "paid" || s.balance === 0) ? totalAmt : 0);

          paidAtCreation = Math.max(0, rawPaid - (linkedCashAmt + linkedBankAmt));
        }
        txs.push({
          date: new Date(s.date || s.createdAt),
          debit: isReturn ? totalAmt : paidAtCreation,
          credit: isReturn ? 0 : totalAmt
        });
      }
    });

    pCashPayments.forEach(py => txs.push({ date: new Date(py.date || py.createdAt), debit: Number(py.amount) || 0, credit: 0 }));
    pBankPayments.forEach(py => txs.push({ date: new Date(py.date || py.createdAt), debit: Number(py.amount) || 0, credit: 0 }));
    pCashReceipts.forEach(r => txs.push({ date: new Date(r.date || r.createdAt), debit: 0, credit: Number(r.amount) || 0 }));
    pBankReceipts.forEach(r => txs.push({ date: new Date(r.date || r.createdAt), debit: 0, credit: Number(r.amount) || 0 }));

    let opening = initialOpening;
    let debitsToday = 0;
    let creditsToday = 0;

    txs.forEach(t => {
      const dStr = getDayStr(t.date);
      if (dStr < dateStr) {
        opening += t.credit - t.debit;
      } else if (dStr === dateStr) {
        debitsToday += t.debit;
        creditsToday += t.credit;
      }
    });

    vendorOpeningTotal += opening;
    vendorPurchasesToday += creditsToday;
    vendorPaymentsToday += debitsToday;
    vendorClosingTotal += (opening + creditsToday - debitsToday);
  });

  console.log("\n=======================================================");
  console.log("FINAL DASHBOARD API RECONCILIATED OUTPUT FOR 2026-08-01:");
  console.log("=======================================================");
  console.log("Sales Today:", Math.round(salesToday));
  console.log("Cash & Bank -> Opening:", cbOpening, "| Receipts:", cbReceipts, "| Payments:", cbPayments, "| Current:", cbCurrent);
  console.log("Receivables -> Opening:", Math.round(custOpeningTotal), "| Sales:", Math.round(custSalesToday), "| Receipts:", Math.round(custReceiptsToday), "| Current:", Math.round(custClosingTotal));
  console.log("Payables    -> Opening:", Math.round(vendorOpeningTotal), "| Purchases:", Math.round(vendorPurchasesToday), "| Payments:", Math.round(vendorPaymentsToday), "| Current:", Math.round(vendorClosingTotal));

  await mongoose.disconnect();
}

main().catch(console.error);
