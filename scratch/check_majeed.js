import mongoose from "mongoose";

const MONGODB_URI = "mongodb+srv://oilshop:Oil%233421@cluster0.68vjmln.mongodb.net/pos_system_db?retryWrites=true&w=majority";

async function main() {
  await mongoose.connect(MONGODB_URI);

  const Party = mongoose.model("Party", new mongoose.Schema({}, { strict: false }));
  const CashReceipt = mongoose.model("CashReceipt", new mongoose.Schema({}, { strict: false }));
  const CashPayment = mongoose.model("CashPayment", new mongoose.Schema({}, { strict: false }));
  const BankReceipt = mongoose.model("BankReceipt", new mongoose.Schema({}, { strict: false }));
  const BankPayment = mongoose.model("BankPayment", new mongoose.Schema({}, { strict: false }));
  const Invoice = mongoose.model("Invoice", new mongoose.Schema({}, { strict: false }));

  const party = await Party.findOne({ name: { $regex: /majeed/i } }).lean();
  console.log("Majeed Sab Party:", party);

  if (party) {
    const invoices = await Invoice.find({ partyId: party._id }).lean();
    console.log(`Invoices count: ${invoices.length}`);

    const cr = await CashReceipt.find({ partyId: party._id }).lean();
    console.log(`Cash Receipts count: ${cr.length}`);
    for (const r of cr) {
      console.log(`CR #${r.receiptNumber} | Date: ${r.date} | Amt: ${r.amount} | Type: ${r.partyReceiptType}`);
    }

    const cp = await CashPayment.find({ $or: [{ partyId: party._id }, { vendor: party._id }] }).lean();
    console.log(`Cash Payments count: ${cp.length}`);
    for (const p of cp) {
      console.log(`CP #${p.voucherNo} | Date: ${p.date} | Amt: ${p.amount}`);
    }
  }

  await mongoose.disconnect();
}

main().catch(console.error);
