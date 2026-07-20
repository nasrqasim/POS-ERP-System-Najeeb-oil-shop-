import mongoose from 'mongoose';
const uri = "mongodb+srv://oilshop:Oil%233421@cluster0.68vjmln.mongodb.net/pos_system_db?retryWrites=true&w=majority";

async function main() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  
  // Find all customers containing 'hadid' case insensitively
  const custs = await db.collection('parties').find({ name: /hadid/i }).toArray();
  console.log("Hadid customer matches:", custs.map(c => ({ code: c.code, name: JSON.stringify(c.name), type: c.type })));
  
  await mongoose.connection.close();
}
main();
