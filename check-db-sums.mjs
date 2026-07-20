import mongoose from 'mongoose';

const uri = "mongodb+srv://oilshop:Oil%233421@cluster0.68vjmln.mongodb.net/pos_system_db?retryWrites=true&w=majority";

async function main() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const customers = await db.collection('parties').find({ type: 'Customer' }).toArray();
  const vendors = await db.collection('parties').find({ type: 'Vendor' }).toArray();

  const cOpening = customers.reduce((s, c) => s + (c.openingBalance || 0), 0);
  const cBalance = customers.reduce((s, c) => s + (c.balance || 0), 0);
  const cDebit = customers.reduce((s, c) => s + (c.debit || 0), 0);
  const cCredit = customers.reduce((s, c) => s + (c.credit || 0), 0);
  const cManualDebit = customers.reduce((s, c) => s + (c.manualDebit || 0), 0);
  const cManualCredit = customers.reduce((s, c) => s + (c.manualCredit || 0), 0);

  const vOpening = vendors.reduce((s, v) => s + (v.openingBalance || 0), 0);
  const vBalance = vendors.reduce((s, v) => s + (v.balance || 0), 0);
  const vDebit = vendors.reduce((s, v) => s + (v.debit || 0), 0);
  const vCredit = vendors.reduce((s, v) => s + (v.credit || 0), 0);
  const vManualDebit = vendors.reduce((s, v) => s + (v.manualDebit || 0), 0);
  const vManualCredit = vendors.reduce((s, v) => s + (v.manualCredit || 0), 0);

  console.log("=== Customer Sums ===");
  console.log("Opening:", cOpening);
  console.log("Current (Balance):", cBalance);
  console.log("Debit:", cDebit);
  console.log("Credit:", cCredit);
  console.log("Manual Debit:", cManualDebit);
  console.log("Manual Credit:", cManualCredit);
  console.log("Period Debits (Sales):", cDebit - cManualDebit);
  console.log("Period Credits (Receipts):", cCredit - cManualCredit);

  console.log("\n=== Vendor Sums ===");
  console.log("Opening:", vOpening);
  console.log("Current (Balance):", vBalance);
  console.log("Debit:", vDebit);
  console.log("Credit:", vCredit);
  console.log("Manual Debit:", vManualDebit);
  console.log("Manual Credit:", vManualCredit);
  console.log("Period Credits (Purchases):", vCredit - vManualCredit);
  console.log("Period Debits (Payments):", vDebit - vManualDebit);

  await mongoose.connection.close();
}

main().catch(err => {
  console.error(err);
  mongoose.connection.close();
});
