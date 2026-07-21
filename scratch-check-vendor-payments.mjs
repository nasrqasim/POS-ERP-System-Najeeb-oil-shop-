import mongoose from 'mongoose';

const uri = "mongodb+srv://oilshop:Oil%233421@cluster0.68vjmln.mongodb.net/pos_system_db?retryWrites=true&w=majority";

async function main() {
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
  });
  const db = mongoose.connection.db;
  
  // Find all cash payments for vendors
  const payments = await db.collection('cashpayments').find().toArray();
  console.log(`Total cashpayments in DB: ${payments.length}`);
  
  let vendorPaymentsCount = 0;
  for (const p of payments) {
    if (p.partyId) {
      const party = await db.collection('parties').findOne({ _id: p.partyId });
      if (party && party.type === 'Vendor') {
        console.log(`Cash Payment: ${p.voucherNo} | Date: ${p.date} | Vendor: ${party.name} (${party.code}) | Amount: ${p.amount} | Status: ${p.status}`);
        vendorPaymentsCount++;
      }
    }
  }
  console.log(`Total cash payments to Vendors: ${vendorPaymentsCount}`);
  
  // Find bank payments for vendors
  const bpayments = await db.collection('bankpayments').find().toArray();
  console.log(`Total bankpayments in DB: ${bpayments.length}`);
  for (const bp of bpayments) {
    console.log(`Bank Payment: ${bp.voucherNo} | Date: ${bp.date} | Vendor: ${bp.vendor} | Amount: ${bp.amount} | Status: ${bp.status}`);
  }
  
  await mongoose.connection.close();
}

main().catch(err => {
  console.error(err);
  mongoose.connection.close();
});
