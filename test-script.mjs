import mongoose from 'mongoose';

const uri = "mongodb+srv://oilshop:Oil%233421@cluster0.68vjmln.mongodb.net/pos_system_db?retryWrites=true&w=majority";

async function main() {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 30000 });
  const db = mongoose.connection.db;
  const accounts = await db.collection('accounts').find({}).toArray();
  console.log("ALL ACCOUNTS:");
  accounts.forEach(a => console.log(`${a.code} | ${a.title} | ${a.type} | Opening: ${a.openingBalance}`));
  await mongoose.disconnect();
}

main().catch(console.error);
