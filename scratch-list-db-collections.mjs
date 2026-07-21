import mongoose from 'mongoose';

const uri = "mongodb+srv://oilshop:Oil%233421@cluster0.68vjmln.mongodb.net/pos_system_db?retryWrites=true&w=majority";

async function main() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();
  for (const coll of collections) {
    const count = await db.collection(coll.name).countDocuments();
    console.log(`Collection: ${coll.name} - count: ${count}`);
  }
  await mongoose.connection.close();
}

main().catch(err => {
  console.error(err);
  mongoose.connection.close();
});
