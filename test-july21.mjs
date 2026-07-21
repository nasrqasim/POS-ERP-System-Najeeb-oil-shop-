import mongoose from 'mongoose';

const uri = "mongodb+srv://oilshop:Oil%233421@cluster0.68vjmln.mongodb.net/pos_system_db?retryWrites=true&w=majority";

async function main() {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 30000 });
  const db = mongoose.connection.db;

  const targetDateStr = "2026-07-21";
  const startOfDay = new Date("2026-07-21T00:00:00.000Z");
  const endOfDay = new Date("2026-07-21T23:59:59.999Z");

  const invoices = await db.collection('invoices').find({
    date: { $gte: startOfDay, $lte: endOfDay },
    status: { $ne: "cancelled" }
  }).toArray();

  console.log("Invoices on July 21, 2026 count:", invoices.length);
  let totalSales = 0;
  let totalCustomerSales = 0;
  let totalPosSales = 0;

  for (const inv of invoices) {
    console.log(`- ${inv.invoiceNo} | Type: ${inv.type} | Total: ${inv.totalAmount} | Customer: ${inv.customerName || inv.partyId}`);
    totalSales += (Number(inv.totalAmount) || 0);
    if (inv.type === 'pos') totalPosSales += Number(inv.totalAmount) || 0;
    else totalCustomerSales += Number(inv.totalAmount) || 0;
  }

  console.log(`TOTAL INVOICE AMOUNT: ${totalSales}`);
  console.log(`Customer Sales: ${totalCustomerSales}`);
  console.log(`POS Sales: ${totalPosSales}`);

  // Check Cash Receipts on July 21, 2026
  const cashReceipts = await db.collection('cashreceipts').find({
    date: { $regex: /^2026-07-21/ },
    status: { $ne: "Cancelled" }
  }).toArray();
  console.log("\nCash Receipts on July 21, 2026:");
  cashReceipts.forEach(r => console.log(`- ${r.receiptNumber} | Party: ${r.partyId} | Amount: ${r.amount}`));

  // Check Cash Payments on July 21, 2026
  const cashPayments = await db.collection('cashpayments').find({
    date: { $regex: /^2026-07-21/ },
    status: { $ne: "Cancelled" }
  }).toArray();
  console.log("\nCash Payments on July 21, 2026:");
  cashPayments.forEach(p => console.log(`- ${p.voucherNo} | Party: ${p.partyId || p.vendor} | Amount: ${p.amount}`));

  await mongoose.disconnect();
}

main().catch(console.error);
