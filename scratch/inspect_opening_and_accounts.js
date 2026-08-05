import mongoose from "mongoose";

const MONGODB_URI = "mongodb+srv://oilshop:Oil%233421@cluster0.68vjmln.mongodb.net/pos_system_db?retryWrites=true&w=majority";

async function main() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;

  const accounts = await db.collection("accounts").find({}).toArray();
  console.log("=== ACCOUNTS IN DB ===");
  accounts.forEach(a => {
    console.log(`Account: ${a.name} | Code: ${a.code} | Type: ${a.type} | OpeningBalance: ${a.openingBalance}`);
  });

  const parties = await db.collection("parties").find({}).toArray();
  console.log("\n=== PARTIES SUMMARY ===");
  const custs = parties.filter(p => p.type === "Customer");
  const vends = parties.filter(p => p.type === "Vendor");

  const totalCustOpening = custs.reduce((s, c) => s + (Number(c.openingBalance) || 0), 0);
  const totalVendOpening = vends.reduce((s, v) => s + (Number(v.openingBalance) || 0), 0);

  console.log(`Total Customer Opening Balances in DB: ${totalCustOpening}`);
  console.log(`Total Vendor Opening Balances in DB: ${totalVendOpening}`);

  await mongoose.disconnect();
}

main().catch(console.error);
