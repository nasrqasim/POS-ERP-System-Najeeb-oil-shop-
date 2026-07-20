import mongoose from 'mongoose';

const uri = "mongodb+srv://oilshop:Oil%233421@cluster0.68vjmln.mongodb.net/pos_system_db?retryWrites=true&w=majority";

async function main() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const vendors = await db.collection('parties').find({ type: 'Vendor' }).toArray();
  
  let opSum = 0;
  let balSum = 0;
  
  vendors.forEach((v, i) => {
    opSum += v.openingBalance || 0;
    balSum += v.balance || 0;
    console.log(`${i}. Code: ${v.code}, Name: ${v.name}, Opening: ${v.openingBalance}, Balance: ${v.balance}`);
  });

  console.log("=== DB Vendor Totals ===");
  console.log("Total Opening Balance:", opSum);
  console.log("Total Current Balance:", balSum);

  await mongoose.connection.close();
}

main().catch(err => {
  console.error(err);
  mongoose.connection.close();
});
