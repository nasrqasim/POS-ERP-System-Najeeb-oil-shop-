import mongoose from 'mongoose';

const uri = "mongodb+srv://oilshop:Oil%233421@cluster0.68vjmln.mongodb.net/pos_system_db?retryWrites=true&w=majority";

async function main() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const invoices = await db.collection('invoices').countDocuments();
  const cashreceipts = await db.collection('cashreceipts').countDocuments();
  const bankreceipts = await db.collection('bankreceipts').countDocuments();
  const cashpayments = await db.collection('cashpayments').countDocuments();
  const bankpayments = await db.collection('bankpayments').countDocuments();
  
  console.log(`Invoices: ${invoices}`);
  console.log(`Cash Receipts: ${cashreceipts}`);
  console.log(`Bank Receipts: ${bankreceipts}`);
  console.log(`Cash Payments: ${cashpayments}`);
  console.log(`Bank Payments: ${bankpayments}`);

  const sampleInvoice = await db.collection('invoices').find().limit(5).toArray();
  console.log("Sample Invoice Dates:", sampleInvoice.map(i => ({ no: i.invoiceNo, date: i.date, type: i.type })));

  await mongoose.connection.close();
}

main().catch(err => {
  console.error(err);
  mongoose.connection.close();
});
