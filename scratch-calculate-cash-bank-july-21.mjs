import mongoose from 'mongoose';

const uri = "mongodb+srv://oilshop:Oil%233421@cluster0.68vjmln.mongodb.net/pos_system_db?retryWrites=true&w=majority";

async function main() {
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
  });
  const db = mongoose.connection.db;
  
  const targetDate = new Date("2026-07-21");
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);
  
  const cashBankCodes = ["00786", "1111", "1110"];
  
  // Initial opening balance from accounts collection
  const cashBankInitialOpening = 1649257.68; // Account 00786 opening
  
  // Transactions before today (Opening Balance as of July 21)
  const cashBankTxBefore = await db.collection('journalentries').aggregate([
    { $match: { accountCode: { $in: cashBankCodes }, date: { $lt: startOfDay } } },
    { $group: { _id: null, debit: { $sum: "$debit" }, credit: { $sum: "$credit" } } }
  ]).toArray();
  
  const beforeDr = cashBankTxBefore[0]?.debit ?? 0;
  const beforeCr = cashBankTxBefore[0]?.credit ?? 0;
  const cashBankOpening = cashBankInitialOpening + beforeDr - beforeCr;
  
  // Receipts today (Debits today)
  const cashBankReceiptsRes = await db.collection('journalentries').aggregate([
    { $match: { accountCode: { $in: cashBankCodes }, date: { $gte: startOfDay, $lte: endOfDay } } },
    { $group: { _id: null, total: { $sum: "$debit" } } }
  ]).toArray();
  const cashBankReceipts = cashBankReceiptsRes[0]?.total ?? 0;
  
  // Payments today (Credits today)
  const cashBankPaymentsRes = await db.collection('journalentries').aggregate([
    { $match: { accountCode: { $in: cashBankCodes }, date: { $gte: startOfDay, $lte: endOfDay } } },
    { $group: { _id: null, total: { $sum: "$credit" } } }
  ]).toArray();
  const cashBankPayments = cashBankPaymentsRes[0]?.total ?? 0;
  
  const cashBankCurrent = cashBankOpening + cashBankReceipts - cashBankPayments;
  
  console.log("=== Cash & Bank Calculations for July 21, 2026 ===");
  console.log("Initial Opening:", cashBankInitialOpening);
  console.log("Before July 21 Debits:", beforeDr);
  console.log("Before July 21 Credits:", beforeCr);
  console.log("Opening Balance:", cashBankOpening);
  console.log("Receipts Today:", cashBankReceipts);
  console.log("Payments Today:", cashBankPayments);
  console.log("Current Balance:", cashBankCurrent);
  
  await mongoose.connection.close();
}

main().catch(err => {
  console.error(err);
  mongoose.connection.close();
});
