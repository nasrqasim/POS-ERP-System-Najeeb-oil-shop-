import mongoose from "mongoose";

const MONGODB_URI = "mongodb+srv://oilshop:Oil%233421@cluster0.68vjmln.mongodb.net/pos_system_db?retryWrites=true&w=majority";

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB Atlas");

  const Party = mongoose.model("Party", new mongoose.Schema({}, { strict: false }));
  const CashReceipt = mongoose.model("CashReceipt", new mongoose.Schema({}, { strict: false }));
  const CashPayment = mongoose.model("CashPayment", new mongoose.Schema({}, { strict: false }));
  const BankReceipt = mongoose.model("BankReceipt", new mongoose.Schema({}, { strict: false }));
  const BankPayment = mongoose.model("BankPayment", new mongoose.Schema({}, { strict: false }));

  // Re-run recalculatePartyBalance for Majeed Sab.
  const majeed = await Party.findOne({ name: { $regex: /majeed/i } }).lean();
  if (majeed) {
    console.log("Found Majeed Sab:", majeed.name, "| Opening Balance:", majeed.openingBalance);
    const crs = await CashReceipt.find({ partyId: majeed._id }).lean();
    console.log(`Cash Receipts for ${majeed.name}:`, crs.map(r => ({ no: r.receiptNumber, amt: r.amount, date: r.date })));
  }

  await mongoose.disconnect();
}

main().catch(console.error);
