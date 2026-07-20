import mongoose from 'mongoose';

const uri = "mongodb+srv://oilshop:Oil%233421@cluster0.68vjmln.mongodb.net/pos_system_db?retryWrites=true&w=majority";

async function main() {
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
  });
  const db = mongoose.connection.db;
  
  // Update Cash in Hand account (code 00786) opening balance to 1,649,257.68
  const cashAccount = await db.collection('accounts').findOne({ code: '00786' });
  if (cashAccount) {
    console.log(`Found cash account: ${cashAccount.code} | ${cashAccount.name} | Current opening: ${cashAccount.openingBalance}`);
    await db.collection('accounts').updateOne(
      { code: '00786' },
      { $set: { openingBalance: 1649257.68 } }
    );
    console.log(`Updated opening balance: ${cashAccount.openingBalance} -> 1649257.68`);
    
    // Verify
    const updated = await db.collection('accounts').findOne({ code: '00786' });
    console.log(`Verified: ${updated.openingBalance}`);
  } else {
    console.log("Cash account 00786 not found!");
  }
  
  await mongoose.connection.close();
}

main().catch(err => {
  console.error(err);
  mongoose.connection.close();
});
