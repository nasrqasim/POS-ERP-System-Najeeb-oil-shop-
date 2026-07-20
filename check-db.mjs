import mongoose from 'mongoose';

const uri = "mongodb+srv://oilshop:Oil%233421@cluster0.68vjmln.mongodb.net/pos_system_db?retryWrites=true&w=majority";

async function main() {
  await mongoose.connect(uri);
  console.log("Connected to MongoDB Atlas");

  const db = mongoose.connection.db;
  
  // List all collections
  const collections = await db.listCollections().toArray();
  console.log("Collections:", collections.map(c => c.name));

  // Count parties
  const partiesCount = await db.collection('parties').countDocuments();
  console.log("partiesCount:", partiesCount);

  // Get sample customer
  const sampleCustomer = await db.collection('parties').findOne({ type: 'Customer' });
  console.log("Sample Customer:", sampleCustomer);

  // Get sample vendor
  const sampleVendor = await db.collection('parties').findOne({ type: 'Vendor' });
  console.log("Sample Vendor:", sampleVendor);

  // Get sample account
  const sampleAccount = await db.collection('accounts').findOne();
  console.log("Sample Account:", sampleAccount);

  // Get sample journal entry
  const sampleJE = await db.collection('journalentries').findOne();
  console.log("Sample JournalEntry:", sampleJE);

  await mongoose.connection.close();
}

main().catch(err => {
  console.error(err);
  mongoose.connection.close();
});
