import mongoose from "mongoose";

const MONGODB_URI = "mongodb+srv://oilshop:Oil%233421@cluster0.68vjmln.mongodb.net/pos_system_db?retryWrites=true&w=majority";

async function main() {
  await mongoose.connect(MONGODB_URI);
  
  const Account = mongoose.model("Account", new mongoose.Schema({}, { strict: false }));
  const Party = mongoose.model("Party", new mongoose.Schema({}, { strict: false }));
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

  // 2. Customers Live Calculation
  const customers = await Party.find({ type: "Customer", status: "Active" }).lean();
  const customerIds = customers.map(c => c._id);
  const custBaseOpening = customers.reduce((s, c) => s + (Number(c.openingBalance) || 0), 0);

  // Sales before targetDate for customers
  const custInvoicesBefore = await Invoice.find({
    partyId: { $in: customerIds },
    date: { $lt: startOfDay },
    status: { $ne: "cancelled" },
    type: { $in: ["sale", "non_tax_sale", "challan", "pos"] }
  }).lean();
  const custSalesBeforeSum = custInvoicesBefore.reduce((s, i) => s + (Number(i.totalAmount) || 0), 0);

  const custReturnsBefore = await Invoice.find({
    partyId: { $in: customerIds },
    date: { $lt: startOfDay },
    status: { $ne: "cancelled" },
    type: { $in: ["sale_return", "non_tax_sale_return"] }
  }).lean();
  const custReturnsBeforeSum = custReturnsBefore.reduce((s, i) => s + (Number(i.totalAmount) || 0), 0);

  // Receipts before targetDate for customers
  const allCashReceipts = await CashReceipt.find({ status: { $ne: "Cancelled" } }).lean();
  const custCashReceiptsBefore = allCashReceipts
    .filter(r => customerIds.some(id => id.toString() === r.partyId?.toString()) && new Date(r.date || r.createdAt) < startOfDay)
    .reduce((s, r) => s + (Number(r.amount) || 0), 0);

  const allBankReceipts = await BankReceipt.find({ status: { $ne: "Cancelled" } }).lean();
  const custBankReceiptsBefore = allBankReceipts
    .filter(r => customerIds.some(id => id.toString() === (r.party?.toString() || r.partyId?.toString())) && new Date(r.date || r.createdAt) < startOfDay)
    .reduce((s, r) => s + (Number(r.amount) || 0), 0);

  const recOpening = custBaseOpening + custSalesBeforeSum - custReturnsBeforeSum - (custCashReceiptsBefore + custBankReceiptsBefore);

  // Receivables today
  const custInvoicesToday = await Invoice.find({
    partyId: { $in: customerIds },
    date: { $gte: startOfDay, $lte: endOfDay },
    status: { $ne: "cancelled" },
    type: { $in: ["sale", "non_tax_sale", "challan", "pos"] }
  }).lean();
  const custSalesTodaySum = custInvoicesToday.reduce((s, i) => s + (Number(i.totalAmount) || 0), 0);

  const custReturnsToday = await Invoice.find({
    partyId: { $in: customerIds },
    date: { $gte: startOfDay, $lte: endOfDay },
    status: { $ne: "cancelled" },
    type: { $in: ["sale_return", "non_tax_sale_return"] }
  }).lean();
  const custReturnsTodaySum = custReturnsToday.reduce((s, i) => s + (Number(i.totalAmount) || 0), 0);

  const recSalesToday = custSalesTodaySum - custReturnsTodaySum;

  const custCashReceiptsToday = allCashReceipts
    .filter(r => customerIds.some(id => id.toString() === r.partyId?.toString()) && new Date(r.date || r.createdAt) >= startOfDay && new Date(r.date || r.createdAt) <= endOfDay)
    .reduce((s, r) => s + (Number(r.amount) || 0), 0);

  const custBankReceiptsToday = allBankReceipts
    .filter(r => customerIds.some(id => id.toString() === (r.party?.toString() || r.partyId?.toString())) && new Date(r.date || r.createdAt) >= startOfDay && new Date(r.date || r.createdAt) <= endOfDay)
    .reduce((s, r) => s + (Number(r.amount) || 0), 0);

  const recReceiptsToday = custCashReceiptsToday + custBankReceiptsToday;
  const recCurrent = recOpening + recSalesToday - recReceiptsToday;

  // 3. Vendors Live Calculation
  const vendors = await Party.find({ type: "Vendor", status: "Active" }).lean();
  const vendorIds = vendors.map(v => v._id);
  const vendBaseOpening = vendors.reduce((s, v) => s + (Number(v.openingBalance) || 0), 0);

  const vendPurchasesBefore = await Invoice.find({
    partyId: { $in: vendorIds },
    date: { $lt: startOfDay },
    status: { $ne: "cancelled" },
    type: { $in: ["purchase", "non_tax_purchase", "import_purchase"] }
  }).lean();
  const vendPurchasesBeforeSum = vendPurchasesBefore.reduce((s, i) => s + (Number(i.totalAmount) || 0), 0);

  const vendReturnsBefore = await Invoice.find({
    partyId: { $in: vendorIds },
    date: { $lt: startOfDay },
    status: { $ne: "cancelled" },
    type: { $in: ["purchase_return", "non_tax_purchase_return"] }
  }).lean();
  const vendReturnsBeforeSum = vendReturnsBefore.reduce((s, i) => s + (Number(i.totalAmount) || 0), 0);

  const allCashPayments = await CashPayment.find({ status: { $ne: "Cancelled" } }).lean();
  const vendCashPaymentsBefore = allCashPayments
    .filter(p => vendorIds.some(id => id.toString() === (p.partyId?.toString() || p.vendor?.toString())) && new Date(p.date || p.createdAt) < startOfDay)
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);

  const allBankPayments = await BankPayment.find({ status: { $ne: "Cancelled" } }).lean();
  const vendBankPaymentsBefore = allBankPayments
    .filter(p => vendorIds.some(id => id.toString() === p.vendor?.toString()) && new Date(p.date || p.createdAt) < startOfDay)
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);

  const payOpening = vendBaseOpening + vendPurchasesBeforeSum - vendReturnsBeforeSum - (vendCashPaymentsBefore + vendBankPaymentsBefore);

  const vendPurchasesToday = await Invoice.find({
    partyId: { $in: vendorIds },
    date: { $gte: startOfDay, $lte: endOfDay },
    status: { $ne: "cancelled" },
    type: { $in: ["purchase", "non_tax_purchase", "import_purchase"] }
  }).lean();
  const payPurchasesToday = vendPurchasesToday.reduce((s, i) => s + (Number(i.totalAmount) || 0), 0);

  const vendCashPaymentsToday = allCashPayments
    .filter(p => vendorIds.some(id => id.toString() === (p.partyId?.toString() || p.vendor?.toString())) && new Date(p.date || p.createdAt) >= startOfDay && new Date(p.date || p.createdAt) <= endOfDay)
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);

  const vendBankPaymentsToday = allBankPayments
    .filter(p => vendorIds.some(id => id.toString() === p.vendor?.toString()) && new Date(p.date || p.createdAt) >= startOfDay && new Date(p.date || p.createdAt) <= endOfDay)
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);

  const payPaymentsToday = vendCashPaymentsToday + vendBankPaymentsToday;
  const payCurrent = payOpening + payPurchasesToday - payPaymentsToday;

  console.log("==========================================");
  console.log("PARTY LIVE DASHBOARD RESULTS FOR DATE:", targetDateStr);
  console.log("==========================================");
  console.log("Sales Today:", salesToday);
  console.log("Receivables:", { opening: Math.round(recOpening), sales: Math.round(recSalesToday), receipts: Math.round(recReceiptsToday), current: Math.round(recCurrent) });
  console.log("Payables   :", { opening: Math.round(payOpening), purchases: Math.round(payPurchasesToday), payments: Math.round(payPaymentsToday), current: Math.round(payCurrent) });

  await mongoose.disconnect();
}

main().catch(console.error);
