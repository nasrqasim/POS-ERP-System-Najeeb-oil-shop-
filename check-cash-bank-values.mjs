import mongoose from 'mongoose';

const uri = "mongodb+srv://oilshop:Oil%233421@cluster0.68vjmln.mongodb.net/pos_system_db?retryWrites=true&w=majority";

async function main() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  
  const targetDate = new Date("2026-07-20");
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);
  
  // Cash/bank accounts
  const cashBankAccs = await db.collection('accounts').find({ type: { $in: ["cash", "bank"] } }).toArray();
  const cashBankCodes = Array.from(new Set(cashBankAccs.map(a => a.code).concat(["1111", "1110", "00786"])));
  
  const cashBankInitialOpening = cashBankAccs.reduce((sum, acc) => sum + (acc.openingBalance ?? 0), 0);
  
  const cashBankTxBefore = await db.collection('journalentries').aggregate([
    { $match: { accountCode: { $in: cashBankCodes }, date: { $lt: startOfDay } } },
    { $group: { _id: null, balance: { $sum: { $subtract: ["$debit", "$credit"] } } } }
  ]).toArray();
  
  const cashBankOpening = cashBankInitialOpening + (cashBankTxBefore[0]?.balance ?? 0);
  
  const cashBankReceiptsRes = await db.collection('journalentries').aggregate([
    { $match: { accountCode: { $in: cashBankCodes }, date: { $gte: startOfDay, $lte: endOfDay } } },
    { $group: { _id: null, total: { $sum: "$debit" } } }
  ]).toArray();
  
  const cashBankReceipts = cashBankReceiptsRes[0]?.total ?? 0;
  
  const cashBankPaymentsRes = await db.collection('journalentries').aggregate([
    { $match: { accountCode: { $in: cashBankCodes }, date: { $gte: startOfDay, $lte: endOfDay } } },
    { $group: { _id: null, total: { $sum: "$credit" } } }
  ]).toArray();
  
  const cashBankPayments = cashBankPaymentsRes[0]?.total ?? 0;
  
  console.log("Cash/Bank codes:", cashBankCodes);
  console.log("Initial opening from Account schemas:", cashBankInitialOpening);
  console.log("Tx before:", cashBankTxBefore[0]?.balance ?? 0);
  console.log("Computed Opening:", cashBankOpening);
  console.log("Computed Receipts:", cashBankReceipts);
  console.log("Computed Payments:", cashBankPayments);
  console.log("Computed Current:", cashBankOpening + cashBankReceipts - cashBankPayments);
  
  await mongoose.connection.close();
}

main().catch(err => {
  console.error(err);
  mongoose.connection.close();
});
