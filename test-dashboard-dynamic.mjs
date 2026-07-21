import mongoose from 'mongoose';

const uri = "mongodb+srv://oilshop:Oil%233421@cluster0.68vjmln.mongodb.net/pos_system_db?retryWrites=true&w=majority";

async function main() {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 30000 });
  const db = mongoose.connection.db;

  const dateParam = "2026-07-21";
  const targetDate = new Date(dateParam);
  
  const startOfDay = new Date(targetDate);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setUTCHours(23, 59, 59, 999);

  console.log(`Testing Dashboard Logic for ${dateParam}`);
  console.log(`Start of day: ${startOfDay.toISOString()}`);
  console.log(`End of day: ${endOfDay.toISOString()}`);

  // 1. Sales Today
  const invoices = await db.collection('invoices').find({
    date: { $gte: startOfDay, $lte: endOfDay },
    status: { $ne: "cancelled" }
  }).toArray();

  let salesToday = 0;
  for (const inv of invoices) {
    const total = Number(inv.totalAmount) || 0;
    if (["sale", "non_tax_sale", "pos", "challan"].includes(inv.type)) {
      salesToday += total;
    } else if (["sale_return", "non_tax_sale_return"].includes(inv.type)) {
      salesToday -= total;
    }
  }
  console.log(`1. Sales Today: ${salesToday} (Target: 80,960)`);

  // 2. Cash & Banks
  const cashAccounts = await db.collection('accounts').find({ type: { $in: ["cash", "bank"] } }).toArray();
  const cashBankCodes = Array.from(new Set(cashAccounts.map(a => a.code).concat(["00786", "1111", "1110"])));
  const initialCashBankOpening = cashAccounts.reduce((sum, a) => sum + (Number(a.openingBalance) || 0), 0);

  // Journal entries before today for cash/bank
  const cbBefore = await db.collection('journalentries').aggregate([
    { $match: { accountCode: { $in: cashBankCodes }, date: { $lt: startOfDay } } },
    { $group: { _id: null, balance: { $sum: { $subtract: ["$debit", "$credit"] } } } }
  ]).toArray();

  const cbOpening = initialCashBankOpening + (cbBefore[0]?.balance ?? 0);

  const cbReceiptsRes = await db.collection('journalentries').aggregate([
    { $match: { accountCode: { $in: cashBankCodes }, date: { $gte: startOfDay, $lte: endOfDay } } },
    { $group: { _id: null, total: { $sum: "$debit" } } }
  ]).toArray();
  const cbReceipts = cbReceiptsRes[0]?.total ?? 0;

  const cbPaymentsRes = await db.collection('journalentries').aggregate([
    { $match: { accountCode: { $in: cashBankCodes }, date: { $gte: startOfDay, $lte: endOfDay } } },
    { $group: { _id: null, total: { $sum: "$credit" } } }
  ]).toArray();
  const cbPayments = cbPaymentsRes[0]?.total ?? 0;
  const cbCurrent = cbOpening + cbReceipts - cbPayments;

  console.log(`2. Cash & Banks: Opening=${cbOpening}, Receipts=${cbReceipts}, Payments=${cbPayments}, Current=${cbCurrent}`);
  console.log(`   (Target: Opening=1,893,115, Receipts=30,120, Payments=696,140, Current=1,227,095)`);

  // 3. Receivables / Customers
  const customerParties = await db.collection('parties').find({ type: "Customer" }).toArray();
  const initialRecOpening = customerParties.reduce((sum, p) => {
    if ((p.name || p.companyName || "").toLowerCase().includes("walk-in")) return sum;
    return sum + (Number(p.openingBalance) || 0);
  }, 0);

  // Customer transactions before today
  const recBefore = await db.collection('journalentries').aggregate([
    { $match: { partyType: "customer", date: { $lt: startOfDay } } },
    { $group: { _id: null, balance: { $sum: { $subtract: ["$debit", "$credit"] } } } }
  ]).toArray();
  const recOpening = initialRecOpening + (recBefore[0]?.balance ?? 0);

  const recSalesRes = await db.collection('journalentries').aggregate([
    { $match: { partyType: "customer", date: { $gte: startOfDay, $lte: endOfDay } } },
    { $group: { _id: null, total: { $sum: "$debit" } } }
  ]).toArray();
  const recSales = recSalesRes[0]?.total ?? 0;

  const recReceiptsRes = await db.collection('journalentries').aggregate([
    { $match: { partyType: "customer", date: { $gte: startOfDay, $lte: endOfDay } } },
    { $group: { _id: null, total: { $sum: "$credit" } } }
  ]).toArray();
  const recReceipts = recReceiptsRes[0]?.total ?? 0;
  const recCurrent = recOpening + recSales - recReceipts;

  console.log(`3. Receivables: Opening=${recOpening}, Sales=${recSales}, Receipts=${recReceipts}, Current=${recCurrent}`);
  console.log(`   (Target: Opening=4,564,641, Sales=54,440, Receipts=0, Current=4,619,081)`);

  // 4. Payables / Vendors
  const vendorParties = await db.collection('parties').find({ type: "Vendor" }).toArray();
  const initialPayOpening = vendorParties.reduce((sum, p) => sum + (Number(p.openingBalance) || 0), 0);

  // Vendor transactions before today
  const payBefore = await db.collection('journalentries').aggregate([
    { $match: { partyType: "vendor", date: { $lt: startOfDay } } },
    { $group: { _id: null, balance: { $sum: { $subtract: ["$credit", "$debit"] } } } }
  ]).toArray();
  const payOpening = initialPayOpening + (payBefore[0]?.balance ?? 0);

  const payPurchasesRes = await db.collection('journalentries').aggregate([
    { $match: { partyType: "vendor", date: { $gte: startOfDay, $lte: endOfDay } } },
    { $group: { _id: null, total: { $sum: "$credit" } } }
  ]).toArray();
  const payPurchases = payPurchasesRes[0]?.total ?? 0;

  const payPaymentsRes = await db.collection('journalentries').aggregate([
    { $match: { partyType: "vendor", date: { $gte: startOfDay, $lte: endOfDay } } },
    { $group: { _id: null, total: { $sum: "$debit" } } }
  ]).toArray();
  const payPayments = payPaymentsRes[0]?.total ?? 0;
  const payCurrent = payOpening + payPurchases - payPayments;

  console.log(`4. Payables: Opening=${payOpening}, Purchases=${payPurchases}, Payments=${payPayments}, Current=${payCurrent}`);
  console.log(`   (Target: Opening=2,896,392, Purchases=0, Payments=500,000, Current=2,396,392)`);

  await mongoose.disconnect();
}

main().catch(console.error);
