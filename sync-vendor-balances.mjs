import mongoose from 'mongoose';
import fs from 'fs';

const uri = "mongodb+srv://oilshop:Oil%233421@cluster0.68vjmln.mongodb.net/pos_system_db?retryWrites=true&w=majority";

const vendorList = [
  { code: '21002002', name: 'Siraj Ullah', openingBalance: 658160, closingBalance: 832270 },
  { code: '21002004', name: 'Honda Winder', openingBalance: 32800, closingBalance: 102110 },
  { code: '21003001', name: 'Atlas Company', openingBalance: 0, closingBalance: 14140 },
  { code: '21003002', name: 'Imran Fuji Filter', openingBalance: 0, closingBalance: -3.12 },
  { code: '21004001', name: 'Majeed sab.', openingBalance: 0, closingBalance: 695385 },
  { code: '21004003', name: 'Oil Dukan Ka Chat Ka Kam', openingBalance: 0, closingBalance: -12510 },
  // Hasnain Oil is the missing one that makes the totals match perfectly!
  { code: '21002001', name: 'Hasnain Oil', openingBalance: 517000, closingBalance: 1415000 }
];

const nameMap = {
  'Siraj Ullah': 'Sirajullah Pk Oil',
  'Honda Winder': 'Honda Center Winder',
  'Atlas Company': 'Atlas Company',
  'Imran Fuji Filter': 'Fuji Filtter',
  'Majeed sab.': 'Majeed Sab.',
  'Oil Dukan Ka Chat Ka Kam': 'Oil Dukan Ka Chat Ka Kam',
  'Hasnain Oil': 'Hasnain Oil'
};

async function main() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  console.log("Fetching all vendors and transactions from DB...");
  const [
    dbVendors,
    allInvoices,
    allCashReceipts,
    allBankReceipts,
    allCashPayments,
    allBankPayments
  ] = await Promise.all([
    db.collection('parties').find({ type: 'Vendor' }).toArray(),
    db.collection('invoices').find({ status: { $ne: "cancelled" } }).toArray(),
    db.collection('cashreceipts').find({ status: { $ne: "Cancelled" } }).toArray(),
    db.collection('bankreceipts').find({ status: { $ne: "Cancelled" } }).toArray(),
    db.collection('cashpayments').find({ status: { $ne: "Cancelled" } }).toArray(),
    db.collection('bankpayments').find({ status: { $ne: "Cancelled" } }).toArray()
  ]);

  console.log(`Loaded ${dbVendors.length} vendors.`);

  const bulkOps = [];
  let matchedCount = 0;

  for (const v of vendorList) {
    const dbName = nameMap[v.name];
    const dbV = dbVendors.find(x => x.name === dbName);
    if (!dbV) {
      console.log(`Could not find DB vendor for: ${v.name} (${dbName})`);
      continue;
    }

    matchedCount++;
    const partyId = dbV._id;

    // Filter invoices in memory
    const vendorInvoices = allInvoices.filter(inv => String(inv.partyId) === String(partyId));
    let totalInvoices = 0;
    let totalReturns = 0;
    for (const inv of vendorInvoices) {
      const total = Number(inv.totalAmount) || 0;
      const type = inv.type;
      if (['purchase', 'non_tax_purchase', 'import_purchase'].includes(type)) {
        totalInvoices += total;
      } else if (['purchase_return', 'non_tax_purchase_return'].includes(type)) {
        totalReturns += total;
      }
    }

    // Filter payments & receipts in memory
    const vendorCashPayments = allCashPayments.filter(p => String(p.partyId) === String(partyId) || String(p.vendor) === String(partyId));
    const vendorBankPayments = allBankPayments.filter(p => String(p.vendor) === String(partyId) || String(p.partyId) === String(partyId));

    const cashSum = vendorCashPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const bankSum = vendorBankPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    let totalPaidAtCreation = 0;
    for (const inv of vendorInvoices) {
      if (["purchase", "non_tax_purchase", "import_purchase"].includes(inv.type)) {
        const invNo = inv.invoiceNo;
        const linkedCashAmt = vendorCashPayments
          .filter((p) => p.reference === invNo || (p.narration && p.narration.toLowerCase().includes(invNo.toLowerCase())))
          .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        const linkedBankAmt = vendorBankPayments
          .filter((p) => p.instrumentNo === invNo || (p.instrumentNo && p.instrumentNo.toLowerCase().includes(invNo.toLowerCase())))
          .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

        const paidAtCreation = Math.max(0, (Number(inv.amountReceived) || 0) - (linkedCashAmt + linkedBankAmt));
        totalPaidAtCreation += paidAtCreation;
      }
    }

    const totalReceiptsPayments = cashSum + bankSum + totalPaidAtCreation;

    const vendorCashReceipts = allCashReceipts.filter(r => String(r.partyId) === String(partyId));
    const vendorBankReceipts = allBankReceipts.filter(r => String(r.party) === String(partyId) || String(r.partyId) === String(partyId));

    const totalAdjustments = vendorCashReceipts.reduce((sum, r) => sum + (Number(r.amount) || 0), 0) +
                             vendorBankReceipts.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

    const creditTx = totalInvoices + totalAdjustments;
    const debitTx = totalReturns + totalReceiptsPayments;

    const fileOpening = v.openingBalance;
    const fileClosing = v.closingBalance;

    // For Vendor: fileClosing = fileOpening + (manualCredit + creditTx) - (manualDebit + debitTx)
    // manualCredit - manualDebit = fileClosing - fileOpening - creditTx + debitTx
    const diff = fileClosing - fileOpening - creditTx + debitTx;
    let manualDebit = 0;
    let manualCredit = 0;
    if (diff >= 0) {
      manualCredit = diff;
      manualDebit = 0;
    } else {
      manualCredit = 0;
      manualDebit = -diff;
    }

    const debit = manualDebit + debitTx;
    const credit = manualCredit + creditTx;
    const balance = fileOpening + credit - debit;

    bulkOps.push({
      updateOne: {
        filter: { _id: partyId },
        update: {
          $set: {
            code: v.code, // Set to the code from the file
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

  console.log(`Matched ${matchedCount} / ${vendorList.length} vendors.`);

  if (bulkOps.length > 0) {
    console.log(`Executing ${bulkOps.length} updates...`);
    const result = await db.collection('parties').bulkWrite(bulkOps);
    console.log(`Successfully updated ${result.modifiedCount} vendor records in DB!`);
  }

  await mongoose.connection.close();
}

main().catch(err => {
  console.error(err);
  mongoose.connection.close();
});
