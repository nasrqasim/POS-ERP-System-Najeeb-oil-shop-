import mongoose from 'mongoose';
import fs from 'fs';

const uri = "mongodb+srv://oilshop:Oil%233421@cluster0.68vjmln.mongodb.net/pos_system_db?retryWrites=true&w=majority";

const nameMap = {
  'ABC 230 (janna)': 'ABC 230 (Janan)',
  'MUHMMMAD KHAN OIL AGENCY': 'Muhmmad Kham Oil Agency',
  'ABC 090 (Noor Deen)': 'ABC 090 (Noor Din)',
  'Akbar Khan': 'Akber Khan',
  'Muhammad Bakhsh 2D': 'Muhammad Bux 2D',
  'Imran Khan Exivaitor': 'imran Khan Exvaitor',
  'Shajee Khan': 'Shah Jee Khan',
  'Saber Severs': 'Saber Sarvice',
  'Ayoub khan': 'Ayuob Khan',
  'Zafer Jamali': 'Zafar Jamali',
  'Al Hadid Naman': 'Al Hadid Naman'
};

function normalizeName(name) {
  if (!name) return "";
  return name.toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const dbCustomers = await db.collection('parties').find({ type: 'Customer' }).toArray();
  const fcName = "Al Hadid Naman";

  console.log("nameMap[fcName] =", nameMap[fcName]);
  const exactNameMapMatch = dbCustomers.find(dc => dc.name === nameMap[fcName]);
  console.log("exactNameMapMatch found?", exactNameMapMatch ? exactNameMapMatch.name : "false");

  const fn = normalizeName(fcName);
  console.log("normalized fcName =", JSON.stringify(fn));
  let match = dbCustomers.find(dc => normalizeName(dc.name) === fn || normalizeName(dc.companyName) === fn);
  console.log("normalized match found?", match ? match.name : "false");

  await mongoose.connection.close();
}
main();
