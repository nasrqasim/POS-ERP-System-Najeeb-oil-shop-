import mongoose from 'mongoose';
import fs from 'fs';

const uri = "mongodb+srv://oilshop:Oil%233421@cluster0.68vjmln.mongodb.net/pos_system_db?retryWrites=true&w=majority";

async function main() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const dbCustomers = await db.collection('parties').find({ type: 'Customer' }).toArray();
  const opList = JSON.parse(fs.readFileSync('D:/oilshop/opening_parsed.json', 'utf8'));

  const missing = [];
  for (const op of opList) {
    const matched = dbCustomers.find(dc => dc.code === op.code);
    if (!matched) {
      missing.push(op);
    }
  }

  console.log("Missing customer codes in DB:", missing.map(m => ({ code: m.code, name: m.name })));

  await mongoose.connection.close();
}

main().catch(err => {
  console.error(err);
  mongoose.connection.close();
});
