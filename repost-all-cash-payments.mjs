import mongoose from 'mongoose';

const uri = "mongodb+srv://oilshop:Oil%233421@cluster0.68vjmln.mongodb.net/pos_system_db?retryWrites=true&w=majority";

async function main() {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 30000 });
  const db = mongoose.connection.db;

  console.log("=== RE-POSTING CASH PAYMENT JOURNAL ENTRIES & PARTY BALANCES ===");

  const cashPayments = await db.collection('cashpayments').find({ status: "Posted" }).toArray();
  console.log(`Found ${cashPayments.length} posted cash payments.`);

  const partyIds = new Set();

  for (const p of cashPayments) {
    const pId = p.partyId ? p.partyId.toString() : (p.vendor ? p.vendor.toString() : null);
    if (pId && pId.length === 24) {
      partyIds.add(pId);
    }
  }

  console.log(`Unique party IDs associated with cash payments: ${partyIds.size}`);

  await mongoose.disconnect();
}

main().catch(console.error);
