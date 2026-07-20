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
  'Al Hadid Naman': 'Al Hadid Noman'
};

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

  console.log("Fetching all customers and transactions from DB in parallel...");
  const [
    dbCustomers,
    allInvoices,
    allCashReceipts,
    allBankReceipts,
    allCashPayments,
    allBankPayments
  ] = await Promise.all([
    db.collection('parties').find({ type: 'Customer' }).toArray(),
    db.collection('invoices').find({ status: { $ne: "cancelled" } }).toArray(),
    db.collection('cashreceipts').find({ status: { $ne: "Cancelled" } }).toArray(),
    db.collection('bankreceipts').find({ status: { $ne: "Cancelled" } }).toArray(),
    db.collection('cashpayments').find({ status: { $ne: "Cancelled" } }).toArray(),
    db.collection('bankpayments').find({ status: { $ne: "Cancelled" } }).toArray()
  ]);

  console.log(`Loaded ${dbCustomers.length} customers, ${allInvoices.length} invoices, ${allCashReceipts.length} cash receipts, ${allBankReceipts.length} bank receipts, ${allCashPayments.length} cash payments, ${allBankPayments.length} bank payments.`);

  const opList = JSON.parse(fs.readFileSync('D:/oilshop/opening_parsed.json', 'utf8'));
  const clList = JSON.parse(fs.readFileSync('D:/oilshop/closing_parsed.json', 'utf8'));

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

  console.log("Reconciling and preparing bulk updates...");

  const bulkOps = [];
  let matchedCount = 0;

  for (const op of opList) {
    const cl = clList.find(c => c.code === op.code);
    const fileClosing = cl ? cl.closingBalance : 0; // Assume 0 if not present in closing balance file

    const dbCust = getDbMatch(op.name);
    if (!dbCust) {
      console.log(`Could not find DB customer for: ${op.name}`);
      continue;
    }

    matchedCount++;
    const partyId = dbCust._id;

    // Filter invoices in memory
    const customerInvoices = allInvoices.filter(inv => String(inv.partyId) === String(partyId));
    let totalInvoices = 0;
    let totalReturns = 0;
    for (const inv of customerInvoices) {
      const total = Number(inv.totalAmount) || 0;
      const type = inv.type;
      if (['sale', 'non_tax_sale', 'pos', 'challan'].includes(type)) {
        totalInvoices += total;
      } else if (['sale_return', 'non_tax_sale_return'].includes(type)) {
        totalReturns += total;
      }
    }

    // Filter receipts & payments in memory
    const customerCashReceipts = allCashReceipts.filter(r => String(r.partyId) === String(partyId));
    const customerBankReceipts = allBankReceipts.filter(r => String(r.party) === String(partyId) || String(r.partyId) === String(partyId));

    const cashSum = customerCashReceipts.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const bankSum = customerBankReceipts.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

    let totalReceivedAtCreation = 0;
    for (const inv of customerInvoices) {
      if (["sale", "non_tax_sale", "pos", "challan"].includes(inv.type)) {
        const invNo = inv.invoiceNo;
        const linkedCashAmt = customerCashReceipts
          .filter((r) => r.reference === invNo || (r.narration && r.narration.toLowerCase().includes(invNo.toLowerCase())))
          .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
        const linkedBankAmt = customerBankReceipts
          .filter((r) => r.instrumentNo === invNo || (r.instrumentNo && r.instrumentNo.toLowerCase().includes(invNo.toLowerCase())))
          .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

        const paidAtCreation = Math.max(0, (Number(inv.amountReceived) || 0) - (linkedCashAmt + linkedBankAmt));
        totalReceivedAtCreation += paidAtCreation;
      }
    }

    const totalReceiptsPayments = cashSum + bankSum + totalReceivedAtCreation;

    const customerCashPayments = allCashPayments.filter(p => String(p.partyId) === String(partyId) || String(p.vendor) === String(partyId));
    const customerBankPayments = allBankPayments.filter(p => String(p.vendor) === String(partyId) || String(p.partyId) === String(partyId));

    const totalAdjustments = customerCashPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) +
                             customerBankPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const debitTx = totalInvoices + totalAdjustments;
    const creditTx = totalReturns + totalReceiptsPayments;

    const fileOpening = op.openingBalance;

    // fileClosing = fileOpening + (manualDebit + debitTx) - (manualCredit + creditTx)
    // manualDebit - manualCredit = fileClosing - fileOpening - debitTx + creditTx
    const diff = fileClosing - fileOpening - debitTx + creditTx;
    let manualDebit = 0;
    let manualCredit = 0;
    if (diff >= 0) {
      manualDebit = diff;
    } else {
      manualCredit = -diff;
    }

    const debit = manualDebit + debitTx;
    const credit = manualCredit + creditTx;
    const balance = fileOpening + debit - credit;

    bulkOps.push({
      updateOne: {
        filter: { _id: partyId },
        update: {
          $set: {
            code: op.code, // Set to the 8-digit code from the file
            openingBalance: fileOpening,
            manualDebit: manualDebit,
            manualCredit: manualCredit,
            debit: debit,
            credit: credit,
            balance: balance
          }
        }
      }
    });
  }

  console.log(`Matched ${matchedCount} / ${opList.length} customers.`);

  if (bulkOps.length > 0) {
    console.log(`Executing ${bulkOps.length} updates...`);
    const result = await db.collection('parties').bulkWrite(bulkOps);
    console.log(`Successfully updated ${result.modifiedCount} customer records in DB!`);
  } else {
    console.log("No updates to execute.");
  }

  await mongoose.connection.close();
}

main().catch(err => {
  console.error(err);
  mongoose.connection.close();
});
