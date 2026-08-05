import mongoose from "mongoose";

const MONGODB_URI = "mongodb+srv://oilshop:Oil%233421@cluster0.68vjmln.mongodb.net/pos_system_db?retryWrites=true&w=majority";

async function main() {
  await mongoose.connect(MONGODB_URI);

  const CashPayment = mongoose.model("CashPayment", new mongoose.Schema({}, { strict: false }));
  const BankPayment = mongoose.model("BankPayment", new mongoose.Schema({}, { strict: false }));
  const JournalEntry = mongoose.model("JournalEntry", new mongoose.Schema({}, { strict: false }));
  const Party = mongoose.model("Party", new mongoose.Schema({}, { strict: false }));

  const atlas = await Party.findOne({ name: { $regex: /atlas/i } }).lean();
  console.log("Atlas Party:", atlas);

  const startOfDay = new Date("2026-08-01T00:00:00.000Z");
  const endOfDay = new Date("2026-08-01T23:59:59.999Z");

  const cashPayAug1 = await CashPayment.find({
    status: { $ne: "Cancelled" }
  }).lean();

  console.log("\n--- All Cash Payments on Aug 1 ---");
  for (const p of cashPayAug1) {
    const d = new Date(p.date || p.createdAt);
    if (d >= startOfDay && d <= endOfDay) {
      console.log(`CP Voucher: ${p.voucherNo || p.receiptNumber} | Amt: ${p.amount || p.netPaid} | PartyId: ${p.partyId} | Vendor: ${p.vendor} | Narr: ${p.narration || p.remarks}`);
    }
  }

  const journalAug1 = await JournalEntry.find({
    date: { $gte: startOfDay, $lte: endOfDay }
  }).lean();

  console.log("\n--- Journal Entries on Aug 1 ---");
  for (const j of journalAug1) {
    console.log(`JE Voucher: ${j.voucherNo} | Acc: ${j.accountCode} (${j.accountTitle}) | Debit: ${j.debit} | Credit: ${j.credit} | PartyId: ${j.partyId} | Remarks: ${j.remarks}`);
  }

  await mongoose.disconnect();
}

main().catch(console.error);
