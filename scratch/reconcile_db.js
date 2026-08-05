import mongoose from "mongoose";

const MONGODB_URI = "mongodb+srv://oilshop:Oil%233421@cluster0.68vjmln.mongodb.net/pos_system_db?retryWrites=true&w=majority";

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB Atlas:", MONGODB_URI);

  const Party = mongoose.model("Party", new mongoose.Schema({}, { strict: false }));
  const Account = mongoose.model("Account", new mongoose.Schema({}, { strict: false }));
  const Invoice = mongoose.model("Invoice", new mongoose.Schema({}, { strict: false }));
  const CashReceipt = mongoose.model("CashReceipt", new mongoose.Schema({}, { strict: false }));
  const CashPayment = mongoose.model("CashPayment", new mongoose.Schema({}, { strict: false }));
  const BankReceipt = mongoose.model("BankReceipt", new mongoose.Schema({}, { strict: false }));
  const BankPayment = mongoose.model("BankPayment", new mongoose.Schema({}, { strict: false }));
  const JournalEntry = mongoose.model("JournalEntry", new mongoose.Schema({}, { strict: false }));

  const customers = await Party.find({ type: "Customer" }).lean();
  const vendors = await Party.find({ type: "Vendor" }).lean();

  const custOpeningSum = customers.reduce((s, c) => s + (Number(c.openingBalance) || 0), 0);
  const vendOpeningSum = vendors.reduce((s, v) => s + (Number(v.openingBalance) || 0), 0);

  console.log(`Customers (${customers.length}): Total Opening Balance = ${custOpeningSum}`);
  console.log(`Vendors (${vendors.length}): Total Opening Balance = ${vendOpeningSum}`);

  const cashBankAccs = await Account.find({ type: { $in: ["cash", "bank"] } }).lean();
  const cashBankOpSum = cashBankAccs.reduce((s, a) => s + (Number(a.openingBalance) || 0), 0);
  console.log(`Cash & Bank Accounts (${cashBankAccs.length}): Total Opening Balance = ${cashBankOpSum}`);

  // Let's check Aug 1 date range
  const targetDateStr = "2026-08-01";
  const startOfDay = new Date(`${targetDateStr}T00:00:00.000Z`);
  const endOfDay = new Date(`${targetDateStr}T23:59:59.999Z`);

  console.log("\n--- Checking August 1, 2026 Invoices ---");
  const invoicesToday = await Invoice.find({ date: { $gte: startOfDay, $lte: endOfDay }, status: { $ne: "cancelled" } }).lean();
  console.log(`Found ${invoicesToday.length} invoices on 2026-08-01:`);
  for (const inv of invoicesToday) {
    console.log(`Inv #${inv.invoiceNo} | Type: ${inv.type} | Total: ${inv.totalAmount} | PartyId: ${inv.partyId}`);
  }

  // Check all sales invoices prior to Aug 1 vs on Aug 1
  const saleTypes = ["sale", "non_tax_sale", "challan", "pos"];
  const salesBefore = await Invoice.aggregate([
    { $match: { type: { $in: saleTypes }, date: { $lt: startOfDay }, status: { $ne: "cancelled" } } },
    { $group: { _id: null, total: { $sum: "$totalAmount" } } }
  ]);
  const salesToday = await Invoice.aggregate([
    { $match: { type: { $in: saleTypes }, date: { $gte: startOfDay, $lte: endOfDay }, status: { $ne: "cancelled" } } },
    { $group: { _id: null, total: { $sum: "$totalAmount" } } }
  ]);

  console.log("\n--- Sales Aggregate ---");
  console.log(`Sales before Aug 1: ${salesBefore[0]?.total || 0}`);
  console.log(`Sales on Aug 1: ${salesToday[0]?.total || 0}`);

  // Check all purchase invoices prior to Aug 1 vs on Aug 1
  const purTypes = ["purchase", "non_tax_purchase", "import_purchase"];
  const purBefore = await Invoice.aggregate([
    { $match: { type: { $in: purTypes }, date: { $lt: startOfDay }, status: { $ne: "cancelled" } } },
    { $group: { _id: null, total: { $sum: "$totalAmount" } } }
  ]);
  const purToday = await Invoice.aggregate([
    { $match: { type: { $in: purTypes }, date: { $gte: startOfDay, $lte: endOfDay }, status: { $ne: "cancelled" } } },
    { $group: { _id: null, total: { $sum: "$totalAmount" } } }
  ]);

  console.log("\n--- Purchase Aggregate ---");
  console.log(`Purchases before Aug 1: ${purBefore[0]?.total || 0}`);
  console.log(`Purchases on Aug 1: ${purToday[0]?.total || 0}`);

  await mongoose.disconnect();
}

main().catch(console.error);
