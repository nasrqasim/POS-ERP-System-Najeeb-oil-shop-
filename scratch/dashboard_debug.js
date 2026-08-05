import mongoose from "mongoose";

const MONGODB_URI = "mongodb+srv://oilshop:Oil%233421@cluster0.68vjmln.mongodb.net/pos_system_db?retryWrites=true&w=majority";

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected");

  const db = mongoose.connection.db;
  const targetDate = "2026-08-01";

  // Helper: normalize date to YYYY-MM-DD
  function toDateStr(d) {
    if (!d) return "";
    if (typeof d === "string") return d.slice(0, 10);
    try { return new Date(d).toISOString().slice(0, 10); } catch { return ""; }
  }

  // 1. Check Cash/Bank accounts
  const accounts = await db.collection("accounts").find({ type: { $in: ["cash", "bank"] } }).toArray();
  const accOpening = accounts.reduce((s, a) => s + (Number(a.openingBalance) || 0), 0);
  console.log("\n=== ACCOUNTS ===");
  accounts.forEach(a => console.log(`  ${a.name} (${a.code}): type=${a.type}, opening=${a.openingBalance}`));
  console.log(`  Total Account Opening: ${accOpening}`);

  // 2. Check CashReceipts
  const allCR = await db.collection("cashreceipts").find({}).toArray();
  let crBefore = 0, crToday = 0, crTodayCount = 0;
  allCR.forEach(r => {
    const d = toDateStr(r.date);
    const amt = Number(r.amount) || 0;
    if (d < targetDate) crBefore += amt;
    else if (d === targetDate) { crToday += amt; crTodayCount++; }
  });
  console.log(`\n=== CASH RECEIPTS ===`);
  console.log(`  Total records: ${allCR.length}`);
  console.log(`  Before ${targetDate}: ${crBefore}`);
  console.log(`  On ${targetDate}: ${crToday} (${crTodayCount} records)`);
  // Show today's CashReceipts
  allCR.filter(r => toDateStr(r.date) === targetDate).forEach(r => {
    console.log(`    ${r.receiptNumber}: ${r.amount} party=${r.partyId}`);
  });

  // 3. Check BankReceipts
  const allBR = await db.collection("bankreceipts").find({}).toArray();
  let brBefore = 0, brToday = 0;
  allBR.forEach(r => {
    const d = toDateStr(r.date);
    const amt = Number(r.amount) || 0;
    if (d < targetDate) brBefore += amt;
    else if (d === targetDate) brToday += amt;
  });
  console.log(`\n=== BANK RECEIPTS ===`);
  console.log(`  Total records: ${allBR.length}`);
  console.log(`  Before ${targetDate}: ${brBefore}`);
  console.log(`  On ${targetDate}: ${brToday}`);

  // 4. Check CashPayments
  const allCP = await db.collection("cashpayments").find({}).toArray();
  let cpBefore = 0, cpToday = 0, cpTodayCount = 0;
  allCP.forEach(p => {
    const d = toDateStr(p.date);
    const amt = Number(p.amount) || 0;
    if (d < targetDate) cpBefore += amt;
    else if (d === targetDate) { cpToday += amt; cpTodayCount++; }
  });
  console.log(`\n=== CASH PAYMENTS ===`);
  console.log(`  Total records: ${allCP.length}`);
  console.log(`  Before ${targetDate}: ${cpBefore}`);
  console.log(`  On ${targetDate}: ${cpToday} (${cpTodayCount} records)`);
  allCP.filter(p => toDateStr(p.date) === targetDate).forEach(p => {
    console.log(`    ${p.voucherNo}: ${p.amount} party=${p.partyId || p.vendor}`);
  });

  // 5. Check BankPayments
  const allBP = await db.collection("bankpayments").find({}).toArray();
  let bpBefore = 0, bpToday = 0;
  allBP.forEach(p => {
    const d = toDateStr(p.date);
    const amt = Number(p.amount) || 0;
    if (d < targetDate) bpBefore += amt;
    else if (d === targetDate) bpToday += amt;
  });
  console.log(`\n=== BANK PAYMENTS ===`);
  console.log(`  Total records: ${allBP.length}`);
  console.log(`  Before ${targetDate}: ${bpBefore}`);
  console.log(`  On ${targetDate}: ${bpToday}`);

  // 6. Cash & Banks Calculation
  const cbOpening = accOpening + crBefore + brBefore - cpBefore - bpBefore;
  const cbReceipts = crToday + brToday;
  const cbPayments = cpToday + bpToday;
  const cbCurrent = cbOpening + cbReceipts - cbPayments;
  console.log(`\n=== CASH & BANKS (Calculated) ===`);
  console.log(`  Opening: ${cbOpening} (expected: 1,807,983)`);
  console.log(`  Receipts: ${cbReceipts} (expected: 164,400)`);
  console.log(`  Payments: ${cbPayments} (expected: 1,403,820)`);
  console.log(`  Current: ${cbCurrent} (expected: 568,563)`);

  // 7. Check Customers
  const customers = await db.collection("parties").find({ type: "Customer", status: "Active" }).toArray();
  const customerIds = new Set(customers.map(c => String(c._id)));
  const custOpenings = customers.reduce((s, c) => s + (Number(c.openingBalance) || 0), 0);
  console.log(`\n=== CUSTOMERS ===`);
  console.log(`  Total active: ${customers.length}`);
  console.log(`  Total opening balances: ${custOpenings}`);

  // 8. Check Sale Invoices
  const saleTypes = ["sale", "non_tax_sale", "challan", "pos"];
  const returnTypes = ["sale_return", "non_tax_sale_return"];
  const allInvoices = await db.collection("invoices").find({ status: { $ne: "cancelled" } }).toArray();
  
  let recDebitBefore = 0, recCreditBefore = 0;
  let recDebitToday = 0, recCreditToday = 0;
  
  allInvoices.forEach(inv => {
    const d = toDateStr(inv.date);
    if (saleTypes.includes(inv.type)) {
      const total = Number(inv.totalAmount) || 0;
      const paid = (Number(inv.amountReceived) > 0 ? Number(inv.amountReceived) : 0) ||
                   (Number(inv.amountPaid) > 0 ? Number(inv.amountPaid) : 0) ||
                   ((inv.paymentMethod === "Cash" || inv.paymentMethod === "Bank" || inv.status === "paid" || inv.balance === 0) ? total : 0);
      const receivable = Math.max(0, total - paid);
      if (d < targetDate) recDebitBefore += receivable;
      else if (d === targetDate) recDebitToday += receivable;
    } else if (returnTypes.includes(inv.type)) {
      const amt = Number(inv.totalAmount) || 0;
      if (d < targetDate) recCreditBefore += amt;
      else if (d === targetDate) recCreditToday += amt;
    }
  });

  // Customer receipts
  let custRcpBefore = 0, custRcpToday = 0;
  allCR.forEach(r => {
    const pid = String(r.partyId?._id || r.partyId || r.party || "");
    if (!customerIds.has(pid)) return;
    const d = toDateStr(r.date);
    if (d < targetDate) custRcpBefore += (Number(r.amount) || 0);
    else if (d === targetDate) custRcpToday += (Number(r.amount) || 0);
  });
  allBR.forEach(r => {
    const pid = String(r.partyId?._id || r.partyId || r.party || "");
    if (!customerIds.has(pid)) return;
    const d = toDateStr(r.date);
    if (d < targetDate) custRcpBefore += (Number(r.amount) || 0);
    else if (d === targetDate) custRcpToday += (Number(r.amount) || 0);
  });
  recCreditBefore += custRcpBefore;
  recCreditToday += custRcpToday;

  const recOpening = custOpenings + recDebitBefore - recCreditBefore;
  console.log(`\n=== RECEIVABLES (Calculated) ===`);
  console.log(`  Customer Openings: ${custOpenings}`);
  console.log(`  Sale Receivables Before: ${recDebitBefore}`);
  console.log(`  Credits Before (returns + cust receipts): ${recCreditBefore}`);
  console.log(`  Opening: ${recOpening} (expected: 4,610,221)`);
  console.log(`  Sales Debits Today: ${recDebitToday} (expected: 12,850)`);
  console.log(`  Receipts Credits Today: ${recCreditToday} (expected: 65,700)`);
  console.log(`  Current: ${recOpening + recDebitToday - recCreditToday} (expected: 4,557,371)`);

  // 9. Check Vendors
  const vendors = await db.collection("parties").find({ type: "Vendor", status: "Active" }).toArray();
  const vendorIds = new Set(vendors.map(v => String(v._id)));
  const vendOpenings = vendors.reduce((s, v) => s + (Number(v.openingBalance) || 0), 0);
  console.log(`\n=== VENDORS ===`);
  console.log(`  Total active: ${vendors.length}`);
  console.log(`  Total opening balances: ${vendOpenings}`);

  // Purchase invoices
  const purchaseTypes = ["purchase", "non_tax_purchase", "import_purchase"];
  const purchaseReturnTypes = ["purchase_return", "non_tax_purchase_return"];
  
  let payCredBefore = 0, payDebBefore = 0;
  let payCredToday = 0, payDebToday = 0;

  allInvoices.forEach(inv => {
    const d = toDateStr(inv.date);
    if (purchaseTypes.includes(inv.type)) {
      const amt = Number(inv.totalAmount) || 0;
      if (d < targetDate) payCredBefore += amt;
      else if (d === targetDate) payCredToday += amt;
    } else if (purchaseReturnTypes.includes(inv.type)) {
      const amt = Number(inv.totalAmount) || 0;
      if (d < targetDate) payDebBefore += amt;
      else if (d === targetDate) payDebToday += amt;
    }
  });

  // Vendor payments (cash + bank)
  let vendPayBefore = 0, vendPayToday = 0;
  allCP.forEach(p => {
    const pid = String(p.partyId?._id || p.partyId || p.vendor || "");
    if (!vendorIds.has(pid)) return;
    const d = toDateStr(p.date);
    if (d < targetDate) vendPayBefore += (Number(p.amount) || 0);
    else if (d === targetDate) vendPayToday += (Number(p.amount) || 0);
  });
  allBP.forEach(p => {
    const pid = String(p.partyId?._id || p.partyId || p.vendor || "");
    if (!vendorIds.has(pid)) return;
    const d = toDateStr(p.date);
    if (d < targetDate) vendPayBefore += (Number(p.amount) || 0);
    else if (d === targetDate) vendPayToday += (Number(p.amount) || 0);
  });
  payDebBefore += vendPayBefore;
  payDebToday += vendPayToday;

  // Vendor receipts (cash/bank receipts from vendors = credits to payables)
  let vendRcpBefore = 0, vendRcpToday = 0;
  allCR.forEach(r => {
    const pid = String(r.partyId?._id || r.partyId || r.party || "");
    if (!vendorIds.has(pid)) return;
    const d = toDateStr(r.date);
    if (d < targetDate) vendRcpBefore += (Number(r.amount) || 0);
    else if (d === targetDate) vendRcpToday += (Number(r.amount) || 0);
  });
  allBR.forEach(r => {
    const pid = String(r.partyId?._id || r.partyId || r.party || "");
    if (!vendorIds.has(pid)) return;
    const d = toDateStr(r.date);
    if (d < targetDate) vendRcpBefore += (Number(r.amount) || 0);
    else if (d === targetDate) vendRcpToday += (Number(r.amount) || 0);
  });
  payCredBefore += vendRcpBefore;
  payCredToday += vendRcpToday;

  const payOpening = vendOpenings + payCredBefore - payDebBefore;
  console.log(`\n=== PAYABLES (Calculated) ===`);
  console.log(`  Vendor Openings: ${vendOpenings}`);
  console.log(`  Purchase Credits Before: ${payCredBefore}`);
  console.log(`  Debits Before (returns + vendor payments): ${payDebBefore}`);
  console.log(`  Opening: ${payOpening} (expected: 2,606,292)`);
  console.log(`  Purchases Credits Today: ${payCredToday} (expected: 1,671,346)`);
  console.log(`  Payments Debits Today: ${payDebToday} (expected: 1,396,800)`);
  console.log(`  Current: ${payOpening + payCredToday - payDebToday} (expected: 2,880,838)`);

  // 10. Check JournalEntries for comparison
  const jeCount = await db.collection("journalentries").countDocuments({});
  const jeTodayCount = await db.collection("journalentries").countDocuments({
    date: { $gte: new Date(targetDate + "T00:00:00Z"), $lte: new Date(targetDate + "T23:59:59Z") }
  });
  const jeStringDate = await db.collection("journalentries").countDocuments({ date: targetDate });
  console.log(`\n=== JOURNAL ENTRIES ===`);
  console.log(`  Total: ${jeCount}`);
  console.log(`  On ${targetDate} (Date match): ${jeTodayCount}`);
  console.log(`  On ${targetDate} (String match): ${jeStringDate}`);

  await mongoose.disconnect();
}

main().catch(console.error);
