import mongoose from 'mongoose';

const uri = "mongodb+srv://oilshop:Oil%233421@cluster0.68vjmln.mongodb.net/pos_system_db?retryWrites=true&w=majority";

const missingCustomers = [
  {
    code: '12002036',
    name: 'MAKKAH EXVITOR',
    companyName: 'MAKKAH EXVITOR',
    type: 'Customer',
    openingBalance: 202440,
    closingBalance: 190,
    balance: 190,
    manualDebit: 0,
    manualCredit: 202250, // 202440 - 190 = 202250 adjustment
    debit: 0,
    credit: 202250,
    phone: '',
    email: '',
    address: '',
    city: '',
    status: 'Active',
    creditLimit: 0,
    creditDays: 30
  },
  {
    code: '12002041',
    name: 'MAKKAH DUBBLE DOOR',
    companyName: 'MAKKAH DUBBLE DOOR',
    type: 'Customer',
    openingBalance: 125490,
    closingBalance: 509,
    balance: 509,
    manualDebit: 0,
    manualCredit: 124981, // 125490 - 509 = 124981 adjustment
    debit: 0,
    credit: 124981,
    phone: '',
    email: '',
    address: '',
    city: '',
    status: 'Active',
    creditLimit: 0,
    creditDays: 30
  }
];

async function main() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  for (const cust of missingCustomers) {
    // Check if already exists
    const existing = await db.collection('parties').findOne({ code: cust.code });
    if (existing) {
      console.log(`Customer ${cust.name} (${cust.code}) already exists, updating...`);
      await db.collection('parties').updateOne(
        { code: cust.code },
        { $set: cust }
      );
    } else {
      console.log(`Creating customer ${cust.name} (${cust.code})...`);
      await db.collection('parties').insertOne({
        ...cust,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
  }

  console.log("Done! Created/updated 2 missing customers.");
  await mongoose.connection.close();
}

main().catch(err => {
  console.error(err);
  mongoose.connection.close();
});
