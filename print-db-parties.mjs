import mongoose from 'mongoose';

const uri = "mongodb+srv://oilshop:Oil%233421@cluster0.68vjmln.mongodb.net/pos_system_db?retryWrites=true&w=majority";

async function main() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const parties = await db.collection('parties').find().toArray();
  console.log(`Total parties in DB: ${parties.length}`);
  
  const customers = parties.filter(p => p.type === 'Customer');
  const vendors = parties.filter(p => p.type === 'Vendor');
  
  console.log(`Customers in DB: ${customers.length}`);
  customers.slice(0, 20).forEach((c, idx) => {
    console.log(`${idx}. Code: ${c.code}, Name: ${c.name}, Company: ${c.companyName}, Balance: ${c.balance}, Opening: ${c.openingBalance}`);
  });

  console.log(`Vendors in DB: ${vendors.length}`);
  vendors.slice(0, 20).forEach((v, idx) => {
    console.log(`${idx}. Code: ${v.code}, Name: ${v.name}, Company: ${v.companyName}, Balance: ${v.balance}, Opening: ${v.openingBalance}`);
  });

  await mongoose.connection.close();
}

main().catch(err => {
  console.error("DB connection failed:", err);
  mongoose.connection.close();
});
