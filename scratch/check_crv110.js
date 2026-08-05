import mongoose from "mongoose";

const MONGODB_URI = "mongodb+srv://oilshop:Oil%233421@cluster0.68vjmln.mongodb.net/pos_system_db?retryWrites=true&w=majority";

async function main() {
  await mongoose.connect(MONGODB_URI);

  const Party = mongoose.model("Party", new mongoose.Schema({}, { strict: false }));
  const CashReceipt = mongoose.model("CashReceipt", new mongoose.Schema({}, { strict: false }));
  const JournalEntry = mongoose.model("JournalEntry", new mongoose.Schema({}, { strict: false }));

  const party = await Party.findOne({ name: { $regex: /majeed/i } }).lean();
  console.log("Majeed Sab Party:", party);

  if (party) {
    const cr = await CashReceipt.find({ partyId: party._id }).lean();
    console.log("Cash Receipts for Majeed Sab:", cr);

    const jes = await JournalEntry.find({ voucherNo: "CRV-00110" }).lean();
    console.log("Journal Entries for CRV-00110:", jes);
  }

  await mongoose.disconnect();
}

main().catch(console.error);
