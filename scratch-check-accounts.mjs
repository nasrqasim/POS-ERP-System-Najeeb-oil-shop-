import mongoose from 'mongoose';

const uri = "mongodb+srv://oilshop:Oil%233421@cluster0.68vjmln.mongodb.net/pos_system_db?retryWrites=true&w=majority";

async function main() {
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
  });
  const db = mongoose.connection.db;
  
  const accounts = await db.collection('accounts').find().toArray();
  console.log("=== Accounts ===");
  for (const acc of accounts) {
    console.log(`${acc.code} | ${acc.name} | ${acc.title} | Type: ${acc.type} | Opening: ${acc.openingBalance}`);
  }
  
  await mongoose.connection.close();
}

main().catch(err => {
  console.error(err);
  mongoose.connection.close();
});
