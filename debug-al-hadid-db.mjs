import mongoose from 'mongoose';
const uri = "mongodb+srv://oilshop:Oil%233421@cluster0.68vjmln.mongodb.net/pos_system_db?retryWrites=true&w=majority";

async function main() {
  try {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;
    const cust = await db.collection('parties').findOne({ name: "Al Hadid Naman" });
    console.log("Customer found:", cust ? { id: cust._id, code: cust.code, name: JSON.stringify(cust.name), type: cust.type } : "NOT FOUND");
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.connection.close();
  }
}
main();
