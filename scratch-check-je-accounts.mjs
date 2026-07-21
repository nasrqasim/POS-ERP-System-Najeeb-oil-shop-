import mongoose from 'mongoose';

const uri = "mongodb+srv://oilshop:Oil%233421@cluster0.68vjmln.mongodb.net/pos_system_db?retryWrites=true&w=majority";

async function main() {
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
  });
  const db = mongoose.connection.db;
  
  const codes = await db.collection('journalentries').aggregate([
    { $group: { 
        _id: "$accountCode", 
        debitSum: { $sum: "$debit" }, 
        creditSum: { $sum: "$credit" },
        count: { $sum: 1 }
    } }
  ]).toArray();
  
  console.log("=== Active Account Codes in Journal Entries ===");
  for (const c of codes) {
    console.log(`Code: ${c._id} | Count: ${c.count} | Debit Sum: ${c.debitSum} | Credit Sum: ${c.creditSum}`);
  }
  
  await mongoose.connection.close();
}

main().catch(err => {
  console.error(err);
  mongoose.connection.close();
});
