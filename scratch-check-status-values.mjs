import mongoose from 'mongoose';

const uri = "mongodb+srv://oilshop:Oil%233421@cluster0.68vjmln.mongodb.net/pos_system_db?retryWrites=true&w=majority";

async function main() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  
  const paymentStatuses = await db.collection('cashpayments').distinct('status');
  console.log("cashpayments status values:", paymentStatuses);
  
  const receiptStatuses = await db.collection('cashreceipts').distinct('status');
  console.log("cashreceipts status values:", receiptStatuses);
  
  // Also count status documents
  for (const st of paymentStatuses) {
    const count = await db.collection('cashpayments').countDocuments({ status: st });
    console.log(`cashpayments with status '${st}': ${count}`);
  }
  for (const st of receiptStatuses) {
    const count = await db.collection('cashreceipts').countDocuments({ status: st });
    console.log(`cashreceipts with status '${st}': ${count}`);
  }
  
  await mongoose.connection.close();
}

main().catch(err => {
  console.error(err);
  mongoose.connection.close();
});
