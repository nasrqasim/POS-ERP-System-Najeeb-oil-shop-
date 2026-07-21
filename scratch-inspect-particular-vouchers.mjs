import mongoose from 'mongoose';

const uri = "mongodb+srv://oilshop:Oil%233421@cluster0.68vjmln.mongodb.net/pos_system_db?retryWrites=true&w=majority";

async function main() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  
  const vouchers = await db.collection('cashpayments').find({ 
    voucherNo: { $in: ['CPV-00039', 'CPV-00040', 'CPV-00041', 'CPV-00042', 'CPV-00043', 'CPV-00044', 'CPV-00045'] } 
  }).toArray();
  
  console.log("=== Cash Payments ===");
  for (const v of vouchers) {
    console.log(JSON.stringify({
      _id: v._id,
      voucherNo: v.voucherNo,
      date: v.date,
      paymentType: v.paymentType,
      amount: v.amount,
      partyId: v.partyId,
      vendor: v.vendor,
      mode: v.mode,
      status: v.status,
      partyPaymentType: v.partyPaymentType,
      contraLines: v.contraLines
    }, null, 2));
    
    const jes = await db.collection('journalentries').find({ voucherNo: v.voucherNo }).toArray();
    console.log(`Journal Entries for ${v.voucherNo}:`, jes.length);
    for (const je of jes) {
      console.log(`  Code: ${je.accountCode} | Title: ${je.accountTitle} | Dr: ${je.debit} | Cr: ${je.credit} | PartyId: ${je.partyId} | PartyType: ${je.partyType}`);
    }
  }
  
  await mongoose.connection.close();
}

main().catch(err => {
  console.error(err);
  mongoose.connection.close();
});
