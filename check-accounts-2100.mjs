import mongoose from 'mongoose';

const uri = "mongodb+srv://oilshop:Oil%233421@cluster0.68vjmln.mongodb.net/pos_system_db?retryWrites=true&w=majority";

async function main() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const accounts = await db.collection('accounts').find({ code: /^2100/ }).toArray();
  accounts.forEach((a, i) => {
    console.log(`${i}. Code: ${a.code}, Title: ${a.title}, Opening: ${a.openingBalance}`);
  });

  await mongoose.connection.close();
}

main().catch(err => {
  console.error(err);
  mongoose.connection.close();
});
