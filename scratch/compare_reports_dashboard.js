import mongoose from "mongoose";

const MONGODB_URI = "mongodb+srv://oilshop:Oil%233421@cluster0.68vjmln.mongodb.net/pos_system_db?retryWrites=true&w=majority";

async function main() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;

  const dateStr = "2026-08-01";
  const startRange = new Date("2000-01-01");
  const endRange = new Date(dateStr + "T23:59:59.999Z");
  const dayStart = new Date(dateStr + "T00:00:00.000Z");

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

  // A. VENDOR BALANCES (Payables)
  const vendors = allParties.filter(p => p.type === "Vendor");
  let vendorTotalOpeningBefore = 0;
  let vendorTotalPurchasesToday = 0;
  let vendorTotalPaymentsToday = 0;
  let vendorTotalClosingToday = 0;

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

    vendorTotalOpeningBefore += opening;
    vendorTotalPurchasesToday += creditsToday;
    vendorTotalPaymentsToday += debitsToday;
    vendorTotalClosingToday += (opening + creditsToday - debitsToday);
  });

  // B. CUSTOMER BALANCES (Receivables)
  const customers = allParties.filter(p => p.type === "Customer");
  let custTotalOpeningBefore = 0;
  let custTotalSalesToday = 0;
  let custTotalReceiptsToday = 0;
  let custTotalClosingToday = 0;

  customers.forEach(p => {
    const partyId = p._id;
    const initialOpening = Math.abs(Number(p.openingBalance) || 0);

    const pInvoices = allInvoices.filter(inv => String(inv.partyId?._id || inv.partyId) === String(partyId));
    const pCashReceipts = allCR.filter(r => String(r.partyId?._id || r.partyId || r.party) === String(partyId));
    const pBankReceipts = allBR.filter(r => String(r.partyId?._id || r.partyId || r.party) === String(partyId));
    const pCashPayments = allCP.filter(py => String(py.partyId?._id || py.partyId || py.customer) === String(partyId));
    const pBankPayments = allBP.filter(py => String(py.customer || py.partyId) === String(partyId));

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
    pCashPayments.forEach(py => txs.push({ date: new Date(py.date || py.createdAt), debit: Number(py.amount) || 0, credit: 0 }));
    pBankPayments.forEach(py => txs.push({ date: new Date(py.date || py.createdAt), debit: Number(py.amount) || 0, credit: 0 }));

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

    custTotalOpeningBefore += opening;
    custTotalSalesToday += debitsToday;
    custTotalReceiptsToday += creditsToday;
    custTotalClosingToday += (opening + debitsToday - creditsToday);
  });

  console.log("=== VENDOR BALANCES SUMMARY FOR 2026-08-01 ===");
  console.log("Opening:", Math.round(vendorTotalOpeningBefore));
  console.log("Purchases (Credits) Today:", Math.round(vendorTotalPurchasesToday));
  console.log("Payments (Debits) Today:", Math.round(vendorTotalPaymentsToday));
  console.log("Closing Balance Today:", Math.round(vendorTotalClosingToday));

  console.log("\n=== CUSTOMER BALANCES SUMMARY FOR 2026-08-01 ===");
  console.log("Opening:", Math.round(custTotalOpeningBefore));
  console.log("Sales (Debits) Today:", Math.round(custTotalSalesToday));
  console.log("Receipts (Credits) Today:", Math.round(custTotalReceiptsToday));
  console.log("Closing Balance Today:", Math.round(custTotalClosingToday));

  await mongoose.disconnect();
}

main().catch(console.error);
