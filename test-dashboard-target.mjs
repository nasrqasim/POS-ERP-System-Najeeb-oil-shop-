import mongoose from 'mongoose';

const uri = "mongodb+srv://oilshop:Oil%233421@cluster0.68vjmln.mongodb.net/pos_system_db?retryWrites=true&w=majority";

async function main() {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 30000 });
  const db = mongoose.connection.db;

  const dateParam = "2026-07-21";
  const targetDate = new Date(dateParam);
  
  // Use UTC or local startOfDay / endOfDay
  const startOfDay = new Date(dateParam + "T00:00:00.000Z");
  const endOfDay = new Date(dateParam + "T23:59:59.999Z");
  const baseCutoffDate = new Date("2026-07-20T00:00:00.000Z");

  console.log(`=== DASHBOARD CALCULATION FOR ${dateParam} ===`);

  // 1. Sales Today (All non-cancelled sale invoices minus sale returns)
  const salesInvoicesRes = await db.collection('invoices').aggregate([
    { $match: { type: { $in: ["sale", "non_tax_sale", "challan", "pos"] }, date: { $gte: startOfDay, $lte: endOfDay }, status: { $ne: "cancelled" } } },
    { $group: { _id: null, total: { $sum: "$totalAmount" } } }
  ]).toArray();
  const salesReturnsRes = await db.collection('invoices').aggregate([
    { $match: { type: { $in: ["sale_return", "non_tax_sale_return"] }, date: { $gte: startOfDay, $lte: endOfDay }, status: { $ne: "cancelled" } } },
    { $group: { _id: null, total: { $sum: "$totalAmount" } } }
  ]).toArray();

  const salesToday = (salesInvoicesRes[0]?.total ?? 0) - (salesReturnsRes[0]?.total ?? 0);

  // 2. Cash & Bank
  const cashAccounts = await db.collection('accounts').find({ type: { $in: ["cash", "bank"] } }).toArray();
  const cashBankCodes = Array.from(new Set(cashAccounts.map(a => a.code).concat(["00786", "1111", "1110"])));

  const baseCbOpening = 1813325; // As of 2026-07-20 start
  const cbPriorTx = await db.collection('journalentries').aggregate([
    { $match: { accountCode: { $in: cashBankCodes }, date: { $gte: baseCutoffDate, $lt: startOfDay } } },
    { $group: { _id: null, balance: { $sum: { $subtract: ["$debit", "$credit"] } } } }
  ]).toArray();
  const cbOpening = baseCbOpening + (cbPriorTx[0]?.balance ?? 0);

  const cbReceiptsRes = await db.collection('journalentries').aggregate([
    { $match: { accountCode: { $in: cashBankCodes }, date: { $gte: startOfDay, $lte: endOfDay } } },
    { $group: { _id: null, total: { $sum: "$debit" } } }
  ]).toArray();
  const cbReceipts = Math.round(cbReceiptsRes[0]?.total ?? 0);

  const cbPaymentsRes = await db.collection('journalentries').aggregate([
    { $match: { accountCode: { $in: cashBankCodes }, date: { $gte: startOfDay, $lte: endOfDay } } },
    { $group: { _id: null, total: { $sum: "$credit" } } }
  ]).toArray();
  const cbPayments = Math.round(cbPaymentsRes[0]?.total ?? 0);
  const cbCurrent = cbOpening + cbReceipts - cbPayments;

  // 3. Receivables
  const baseRecOpening = 4553241; // As of 2026-07-20 start
  const recPriorTx = await db.collection('journalentries').aggregate([
    { $match: { partyType: "customer", date: { $gte: baseCutoffDate, $lt: startOfDay } } },
    { $group: { _id: null, balance: { $sum: { $subtract: ["$debit", "$credit"] } } } }
  ]).toArray();
  const recOpening = baseRecOpening + (recPriorTx[0]?.balance ?? 0);

  // Credit sales today (Customer invoices on target date)
  const recSalesRes = await db.collection('invoices').aggregate([
    { $match: { type: { $in: ["sale", "non_tax_sale", "challan"] }, date: { $gte: startOfDay, $lte: endOfDay }, status: { $ne: "cancelled" } } },
    { $group: { _id: null, total: { $sum: "$totalAmount" } } }
  ]).toArray();
  const recSales = recSalesRes[0]?.total ?? 0;

  // Customer receipts today
  const recReceiptsRes = await db.collection('journalentries').aggregate([
    { $match: { partyType: "customer", date: { $gte: startOfDay, $lte: endOfDay } } },
    { $group: { _id: null, total: { $sum: "$credit" } } }
  ]).toArray();
  const recReceipts = Math.round(recReceiptsRes[0]?.total ?? 0);
  const recCurrent = recOpening + recSales - recReceipts;

  // 4. Payables
  const basePayOpening = 2896392; // As of 2026-07-20 start
  const payPriorTx = await db.collection('journalentries').aggregate([
    { $match: { partyType: "vendor", date: { $gte: baseCutoffDate, $lt: startOfDay } } },
    { $group: { _id: null, balance: { $sum: { $subtract: ["$credit", "$debit"] } } } }
  ]).toArray();
  const payOpening = basePayOpening + (payPriorTx[0]?.balance ?? 0);

  // Purchases today
  const payPurchasesRes = await db.collection('invoices').aggregate([
    { $match: { type: { $in: ["purchase", "non_tax_purchase", "import_purchase"] }, date: { $gte: startOfDay, $lte: endOfDay }, status: { $ne: "cancelled" } } },
    { $group: { _id: null, total: { $sum: "$totalAmount" } } }
  ]).toArray();
  const payPurchases = payPurchasesRes[0]?.total ?? 0;

  // Vendor payments today
  const payPaymentsRes = await db.collection('journalentries').aggregate([
    { $match: { partyType: "vendor", date: { $gte: startOfDay, $lte: endOfDay } } },
    { $group: { _id: null, total: { $sum: "$debit" } } }
  ]).toArray();
  const payPayments = Math.round(payPaymentsRes[0]?.total ?? 0);
  const payCurrent = payOpening + payPurchases - payPayments;

  console.log(`Sales Today: ${salesToday}`);
  console.log(`Cash & Bank: Opening=${cbOpening}, Receipts=${cbReceipts}, Payments=${cbPayments}, Current=${cbCurrent}`);
  console.log(`Receivables: Opening=${recOpening}, Sales=${recSales}, Receipts=${recReceipts}, Current=${recCurrent}`);
  console.log(`Payables:    Opening=${payOpening}, Purchases=${payPurchases}, Payments=${payPayments}, Current=${payCurrent}`);

  await mongoose.disconnect();
}

main().catch(console.error);
