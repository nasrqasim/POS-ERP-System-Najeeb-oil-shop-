import mongoose from 'mongoose';
import fs from 'fs';

const uri = "mongodb+srv://oilshop:Oil%233421@cluster0.68vjmln.mongodb.net/pos_system_db?retryWrites=true&w=majority";

function normalizeName(name) {
  if (!name) return "";
  return name.toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace("kham", "khan")
    .replace("birohi", "brohi")
    .replace("lakrah", "lakhra")
    .replace("atos", "atous")
    .replace("exivaitor", "exvitor")
    .replace("exviotor", "exvitor")
    .replace("loader", "loder")
    .replace("blue loder", "blue loader")
    .replace("noor deen", "noor ud deen");
}

async function main() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const dbCustomers = await db.collection('parties').find({ type: 'Customer' }).toArray();
  const fileCustomers = JSON.parse(fs.readFileSync('D:/oilshop/opening_parsed.json', 'utf8'));

  console.log(`DB Customers: ${dbCustomers.length}`);
  console.log(`File Customers: ${fileCustomers.length}`);

  let matchedCount = 0;
  const matches = [];
  const unmatchedFile = [];
  const unmatchedDB = [];

  for (const fc of fileCustomers) {
    const fn = normalizeName(fc.name);
    // Try exact match or normalized match
    let match = dbCustomers.find(dc => normalizeName(dc.name) === fn || normalizeName(dc.companyName) === fn);
    if (!match) {
      // Try substring matching
      match = dbCustomers.find(dc => {
        const dcn = normalizeName(dc.name);
        return dcn.includes(fn) || fn.includes(dcn);
      });
    }
    
    if (match) {
      matchedCount++;
      matches.push({ file: fc.name, db: match.name, code: fc.code, dbId: match._id });
    } else {
      unmatchedFile.push(fc);
    }
  }

  console.log(`Matched: ${matchedCount} / ${fileCustomers.length}`);
  console.log("Matches sample:", matches.slice(0, 10));
  console.log("Unmatched File Customers:", unmatchedFile.map(c => `${c.code}: ${c.name}`));

  await mongoose.connection.close();
}

main().catch(err => {
  console.error(err);
  mongoose.connection.close();
});
