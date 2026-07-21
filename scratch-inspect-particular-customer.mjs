import mongoose from 'mongoose';

const uri = "mongodb+srv://oilshop:Oil%233421@cluster0.68vjmln.mongodb.net/pos_system_db?retryWrites=true&w=majority";

async function main() {
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
  });
  const db = mongoose.connection.db;
  
  const party = await db.collection('parties').findOne({ _id: new mongoose.Types.ObjectId("6a0ddf5c2d4f71be9b77c1d9") });
  console.log("Party:", party);
  
  await mongoose.connection.close();
}

main().catch(err => {
  console.error(err);
  mongoose.connection.close();
});
