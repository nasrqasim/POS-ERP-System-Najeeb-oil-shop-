import mongoose from "mongoose";

const MONGODB_URI = "mongodb+srv://oilshop:Oil%233421@cluster0.68vjmln.mongodb.net/pos_system_db?retryWrites=true&w=majority";

async function main() {
  await mongoose.connect(MONGODB_URI);
  
  const Party = mongoose.model("Party", new mongoose.Schema({}, { strict: false }));
  const Account = mongoose.model("Account", new mongoose.Schema({}, { strict: false }));
  const Invoice = mongoose.model("Invoice", new mongoose.Schema({}, { strict: false }));
  const CashReceipt = mongoose.model("CashReceipt", new mongoose.Schema({}, { strict: false }));
  const CashPayment = mongoose.model("CashPayment", new mongoose.Schema({}, { strict: false }));
  const BankReceipt = mongoose.model("BankReceipt", new mongoose.Schema({}, { strict: false }));
  const BankPayment = mongoose.model("BankPayment", new mongoose.Schema({}, { strict: false }));

  const targetDateStr = "2026-08-01";
  const startOfDay = new Date(`${targetDateStr}T00:00:00.000Z`);
  const endOfDay = new Date(`${targetDateStr}T23:59:59.999Z`);

  // 1. Sales today
  const salesInvoicesTodayRes = await Invoice.aggregate([
    { $match: { type: { $in: ["sale", "non_tax_sale", "challan", "pos"] }, date: { $gte: startOfDay, $lte: endOfDay }, status: { $ne: "cancelled" } } },
    { $group: { _id: null, total: { $sum: "$totalAmount" } } }
  ]);
  const returnsTodayRes = await Invoice.aggregate([
    { $match: { type: { $in: ["sale_return", "non_tax_sale_return"] }, date: { $gte: startOfDay, $lte: endOfDay }, status: { $ne: "cancelled" } } },
    { $group: { _id: null, total: { $sum: "$totalAmount" } } }
  ]);
  const salesToday = (salesInvoicesTodayRes[0]?.total ?? 0) - (returnsTodayRes[0]?.total ?? 0);

  // 2. Cash & Banks
  const cashAccounts = await Account.find({ type: { $in: ["cash", "bank"] } }).lean();
  const cashAccountIds = cashAccounts.map(a => a._id);
  const initialCashOp = cashAccounts.reduce((s, a) => s + (Number(a.openingBalance) || 0), 0);

  // Cash Receipts before Aug 1
  const crBefore = await CashReceipt.find({ status: { $ne: "Cancelled" }, createdAt: { $lt: startOfDay } }).lean();
  // We check date or createdAt
  const crBeforeSum = (await CashReceipt.find({ status: { $ne: "Cancelled" } }).lean())
    .filter(r => new Date(r.date || r.createdAt) < startOfDay)
    .reduce((s, r) => s + (Number(r.amount) || 0), 0);

  const cpBeforeSum = (await CashPayment.find({ status: { $ne: "Cancelled" } }).lean())
    .filter(p => new Date(p.date || p.createdAt) < startOfDay)
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);

  const cbOpening = initialCashOp + crBeforeSum - cpBeforeSum;

  const crTodaySum = (await CashReceipt.find({ status: { $ne: "Cancelled" } }).lean())
    .filter(r => {
      const d = new Date(r.date || r.createdAt);
      return d >= startOfDay && d <= endOfDay;
    })
    .reduce((s, r) => s + (Number(r.amount) || 0), 0);

  const cpTodaySum = (await CashPayment.find({ status: { $ne: "Cancelled" } }).lean())
    .filter(p => {
      const d = new Date(p.date || p.createdAt);
      return d >= startOfDay && d <= endOfDay;
    })
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);

  console.log("--- CASH & BANKS LIVE CALCULATION ---");
  console.log(`Initial Cash Op: ${initialCashOp}`);
  console.log(`CR Before Aug 1: ${crBeforeSum}`);
  console.log(`CP Before Aug 1: ${cpBeforeSum}`);
  console.log(`Calculated CB Opening: ${cbOpening}`);
  console.log(`CR Today: ${crTodaySum}`);
  console.log(`CP Today: ${cpTodaySum}`);
  console.log(`Calculated CB Current: ${cbOpening + crTodaySum - cpTodaySum}`);

  // 3. Receivables / Customers
  const customers = await Party.find({ type: "Customer" }).lean();
  const custOpeningBase = customers.reduce((s, c) => s + (Number(c.openingBalance) || 0), 0);

  console.log("\n--- CUSTOMER LIVE CALCULATION ---");
  console.log(`Base Customer Opening Total: ${custOpeningBase}`);

  // 4. Payables / Vendors
  const vendors = await Party.find({ type: "Vendor" }).lean();
  const vendOpeningBase = vendors.reduce((s, v) => s + (Number(v.openingBalance) || 0), 0);

  console.log("\n--- VENDOR LIVE CALCULATION ---");
  console.log(`Base Vendor Opening Total: ${vendOpeningBase}`);

  await mongoose.disconnect();
}

main().catch(console.error);
