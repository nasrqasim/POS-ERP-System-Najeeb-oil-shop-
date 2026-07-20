import mongoose from 'mongoose';

const uri = "mongodb+srv://oilshop:Oil%233421@cluster0.68vjmln.mongodb.net/pos_system_db?retryWrites=true&w=majority";

async function main() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const dbCustomers = await db.collection('parties').find({ type: 'Customer' }).toArray();
  dbCustomers.sort((a, b) => a.name.localeCompare(b.name));
  
  dbCustomers.forEach((c, i) => {
    console.log(`${i}. Code: ${c.code}, Name: ${c.name}, Company: ${c.companyName}`);
  });

  await mongoose.connection.close();
}

main().catch(err => {
  console.error(err);
  mongoose.connection.close();
});
