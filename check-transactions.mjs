import mongoose from 'mongoose';

const uri = "mongodb+srv://oilshop:Oil%233421@cluster0.68vjmln.mongodb.net/pos_system_db?retryWrites=true&w=majority";

async function main() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const minDate = new Date("2026-06-10");
  const maxDate = new Date("2026-07-21");

  const invoicesCount = await db.collection('invoices').countDocuments({ date: { $gte: minDate, $lte: maxDate } });
  const cashReceiptsCount = await db.collection('cashreceipts').countDocuments({ date: { $gte: minDate, $lte: maxDate } });
  const bankReceiptsCount = await db.collection('bankreceipts').countDocuments({ date: { $gte: minDate, $lte: maxDate } });
  const cashPaymentsCount = await db.collection('cashpayments').countDocuments({ date: { $gte: minDate, $lte: maxDate } });
  const bankPaymentsCount = await db.collection('bankpayments').countDocuments({ date: { $gte: minDate, $lte: maxDate } });

  console.log("Transactions between 2026-06-10 and 2026-07-21:");
  console.log("Invoices Count:", invoicesCount);
  console.log("Cash Receipts Count:", cashReceiptsCount);
  console.log("Bank Receipts Count:", bankReceiptsCount);
  console.log("Cash Payments Count:", cashPaymentsCount);
  console.log("Bank Payments Count:", bankPaymentsCount);

  // Let's print unique dates in this range
  const invoiceDates = await db.collection('invoices').distinct('date', { date: { $gte: minDate, $lte: maxDate } });
  console.log("Invoice Dates in range:", invoiceDates.map(d => d.toISOString().split('T')[0]));

  await mongoose.connection.close();
}

main().catch(err => {
  console.error(err);
  mongoose.connection.close();
});
