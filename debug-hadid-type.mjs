import mongoose from 'mongoose';
const uri = "mongodb+srv://oilshop:Oil%233421@cluster0.68vjmln.mongodb.net/pos_system_db?retryWrites=true&w=majority";

async function main() {
  try {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;
    const custs = await db.collection('parties').find({ name: /hadid/i }).toArray();
    console.log("Found:", custs.map(c => ({ code: c.code, name: c.name, type: c.type })));
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.connection.close();
  }
}
main();
