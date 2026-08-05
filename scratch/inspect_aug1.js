import mongoose from "mongoose";

const MONGODB_URI = "mongodb+srv://oilshop:Oil%233421@cluster0.68vjmln.mongodb.net/pos_system_db?retryWrites=true&w=majority";

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to DB");

  const db = mongoose.connection.db;

  const invs = await db.collection("invoices").find({}).toArray();
  const crs = await db.collection("cashreceipts").find({}).toArray();
  const brs = await db.collection("bankreceipts").find({}).toArray();
  const cps = await db.collection("cashpayments").find({}).toArray();
  const bps = await db.collection("bankpayments").find({}).toArray();

  console.log("Invoices count:", invs.length);
  console.log("Cash Receipts count:", crs.length);
  console.log("Cash Payments count:", cps.length);

  console.log("\nInvoices around 2026-08-01:");
  invs.forEach(i => {
    const d = new Date(i.date || i.createdAt).toISOString();
    if (d.includes("2026-07-31") || d.includes("2026-08-01") || d.includes("2026-08-02")) {
      console.log(`INV: ${i.invoiceNo} | type: ${i.type} | total: ${i.totalAmount} | date: ${i.date} | ISO: ${d}`);
    }
  });

  console.log("\nCash Receipts around 2026-08-01:");
  crs.forEach(r => {
    const d = new Date(r.date || r.createdAt).toISOString();
    if (d.includes("2026-07-31") || d.includes("2026-08-01") || d.includes("2026-08-02")) {
      console.log(`CR: ${r.receiptNumber} | amt: ${r.amount} | date: ${r.date} | ISO: ${d}`);
    }
  });

  console.log("\nCash Payments around 2026-08-01:");
  cps.forEach(p => {
    const d = new Date(p.date || p.createdAt).toISOString();
    if (d.includes("2026-07-31") || d.includes("2026-08-01") || d.includes("2026-08-02")) {
      console.log(`CP: ${p.voucherNo} | amt: ${p.amount} | date: ${p.date} | ISO: ${d}`);
    }
  });

  await mongoose.disconnect();
}

main().catch(console.error);
