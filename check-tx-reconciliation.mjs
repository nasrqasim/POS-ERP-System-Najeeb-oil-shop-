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
  const opList = JSON.parse(fs.readFileSync('D:/oilshop/opening_parsed.json', 'utf8'));
  const clList = JSON.parse(fs.readFileSync('D:/oilshop/closing_parsed.json', 'utf8'));

  // Custom mapping for unmatched/special ones
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

  const getDbMatch = (fcName) => {
    if (nameMap[fcName]) {
      return dbCustomers.find(dc => dc.name === nameMap[fcName]);
    }
    const fn = normalizeName(fcName);
    let match = dbCustomers.find(dc => normalizeName(dc.name) === fn || normalizeName(dc.companyName) === fn);
    if (!match) {
      match = dbCustomers.find(dc => {
        const dcn = normalizeName(dc.name);
        return dcn.includes(fn) || fn.includes(dcn);
      });
    }
    return match;
  };

  let diffCount = 0;
  for (const op of opList) {
    const cl = clList.find(c => c.code === op.code);
    if (!cl) continue;

    const dbCust = getDbMatch(op.name);
    if (!dbCust) {
      console.log(`No DB match for ${op.code}: ${op.name}`);
      continue;
    }

    // Now recalculate for this dbCust._id
    const partyId = dbCust._id;
    const invoices = await db.collection('invoices').find({ partyId, status: { $ne: "cancelled" } }).toArray();
    let totalInvoices = 0;
    let totalReturns = 0;
    for (const inv of invoices) {
      const total = Number(inv.totalAmount) || 0;
      const type = inv.type;
      if (['sale', 'non_tax_sale', 'pos', 'challan'].includes(type)) {
        totalInvoices += total;
      } else if (['sale_return', 'non_tax_sale_return'].includes(type)) {
        totalReturns += total;
      }
    }

    const cashReceipts = await db.collection('cashreceipts').find({ partyId, status: { $ne: "Cancelled" } }).toArray();
    const bankReceipts = await db.collection('bankreceipts').find({
      $or: [{ party: partyId }, { party: String(partyId) }],
      status: { $ne: "Cancelled" }
    }).toArray();

    const cashSum = cashReceipts.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const bankSum = bankReceipts.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

    let totalReceivedAtCreation = 0;
    for (const inv of invoices) {
      if (["sale", "non_tax_sale", "pos", "challan"].includes(inv.type)) {
        const invNo = inv.invoiceNo;
        const linkedCashAmt = cashReceipts
          .filter((r) => r.reference === invNo || (r.narration && r.narration.toLowerCase().includes(invNo.toLowerCase())))
          .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
        const linkedBankAmt = bankReceipts
          .filter((r) => r.instrumentNo === invNo || (r.instrumentNo && r.instrumentNo.toLowerCase().includes(invNo.toLowerCase())))
          .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

        const paidAtCreation = Math.max(0, (Number(inv.amountReceived) || 0) - (linkedCashAmt + linkedBankAmt));
        totalReceivedAtCreation += paidAtCreation;
      }
    }

    const totalReceiptsPayments = cashSum + bankSum + totalReceivedAtCreation;

    const cashPayments = await db.collection('cashpayments').find({
      $or: [{ partyId }, { vendor: partyId }],
      status: { $ne: "Cancelled" }
    }).toArray();
    const bankPayments = await db.collection('bankpayments').find({ vendor: partyId, status: { $ne: "Cancelled" } }).toArray();
    
    const totalAdjustments = cashPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) +
                             bankPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const debit = totalInvoices + totalAdjustments;
    const credit = totalReturns + totalReceiptsPayments;

    const expectedClosing = op.closingBalance + debit - credit; // Wait, let's verify if file matches!
    const fileOpening = op.openingBalance;
    const fileClosing = cl.closingBalance;

    const computedClosing = fileOpening + debit - credit;

    const diff = Math.abs(computedClosing - fileClosing);
    if (diff > 0.01) {
      diffCount++;
      console.log(`Mismatched: Code ${op.code} | Name: ${op.name} (${dbCust.name})`);
      console.log(`  File Opening: ${fileOpening} | File Closing: ${fileClosing}`);
      console.log(`  Computed Closing (Opening + Debit - Credit): ${computedClosing}`);
      console.log(`  Difference: ${computedClosing - fileClosing}`);
      console.log(`  Transactions -> Debit: ${debit} | Credit: ${credit}`);
    }
  }

  console.log(`Total Mismatched Customers: ${diffCount}`);
  await mongoose.connection.close();
}

main().catch(err => {
  console.error(err);
  mongoose.connection.close();
});
