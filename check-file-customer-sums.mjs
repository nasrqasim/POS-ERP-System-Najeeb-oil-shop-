import mongoose from 'mongoose';

const uri = "mongodb+srv://oilshop:Oil%233421@cluster0.68vjmln.mongodb.net/pos_system_db?retryWrites=true&w=majority";

async function main() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  // Customers with 8-digit codes starting with 1200 (or generally 12)
  const customers = await db.collection('parties').find({ type: 'Customer', code: /^[0-9]{8}$/ }).toArray();
  // Vendors with 8-digit codes starting with 2100 (or generally 21)
  const vendors = await db.collection('parties').find({ type: 'Vendor', code: /^[0-9]{8}$/ }).toArray();

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

  console.log("=== File-matched Customer Sums ===");
  console.log("Count:", customers.length);
  console.log("Opening:", cOpening);
  console.log("Current (Balance):", cBalance);
  console.log("Sales (Period):", cDebit - cManualDebit);
  console.log("Receipts (Period):", cCredit - cManualCredit);

  console.log("\n=== File-matched Vendor Sums ===");
  console.log("Count:", vendors.length);
  console.log("Opening:", vOpening);
  console.log("Current (Balance):", vBalance);
  console.log("Purchases (Period):", vCredit - vManualCredit);
  console.log("Payments (Period):", vDebit - vManualDebit);

  await mongoose.connection.close();
}

main().catch(err => {
  console.error(err);
  mongoose.connection.close();
});
