import mongoose from 'mongoose';

const MONGODB_URI = "mongodb+srv://oilshop:Oil%233421@cluster0.68vjmln.mongodb.net/pos_system_db?retryWrites=true&w=majority";

async function analyze2000Entries() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB!");

  const targetDate = new Date('2000-01-01');
  const targetDateEnd = new Date('2000-01-02');
  
  console.log("\n=== Searching for entries dated 01/01/2000 ===\n");

  // Check JournalEntry collection
  const journalEntries = await mongoose.connection.collection('journalentries')
    .find({
      date: { $gte: targetDate, $lt: targetDateEnd }
    })
    .toArray();
  console.log(`JournalEntry: Found ${journalEntries.length} entries on 01/01/2000`);
  if (journalEntries.length > 0) {
    console.log("Sample entries:");
    journalEntries.slice(0, 5).forEach(entry => {
      console.log(`  - ${entry.voucherNo || 'No voucher'} | Party: ${entry.partyId} | Debit: ${entry.debit} | Credit: ${entry.credit} | Remarks: ${entry.remarks}`);
    });
  }

  // Check Invoice collection
  const invoices = await mongoose.connection.collection('invoices')
    .find({
      date: { $gte: targetDate, $lt: targetDateEnd }
    })
    .toArray();
  console.log(`\nInvoice: Found ${invoices.length} entries on 01/01/2000`);
  if (invoices.length > 0) {
    console.log("Sample entries:");
    invoices.slice(0, 5).forEach(inv => {
      console.log(`  - ${inv.invoiceNo} | Type: ${inv.type} | Party: ${inv.partyId} | Amount: ${inv.totalAmount}`);
    });
  }

  // Check CashReceipt collection
  const cashReceipts = await mongoose.connection.collection('cashreceipts')
    .find({
      date: { $gte: targetDate.toISOString().split('T')[0], $lte: targetDate.toISOString().split('T')[0] }
    })
    .toArray();
  console.log(`\nCashReceipt: Found ${cashReceipts.length} entries on 01/01/2000`);
  if (cashReceipts.length > 0) {
    console.log("Sample entries:");
    cashReceipts.slice(0, 5).forEach(cr => {
      console.log(`  - ${cr.receiptNumber} | Party: ${cr.partyId} | Amount: ${cr.amount} | Status: ${cr.status}`);
    });
  }

  // Check BankReceipt collection
  const bankReceipts = await mongoose.connection.collection('bankreceipts')
    .find({
      date: { $gte: targetDate.toISOString().split('T')[0], $lte: targetDate.toISOString().split('T')[0] }
    })
    .toArray();
  console.log(`\nBankReceipt: Found ${bankReceipts.length} entries on 01/01/2000`);
  if (bankReceipts.length > 0) {
    console.log("Sample entries:");
    bankReceipts.slice(0, 5).forEach(br => {
      console.log(`  - ${br.receiptNumber} | Party: ${br.party} | Amount: ${br.amount} | Status: ${br.status}`);
    });
  }

  // Check CashPayment collection
  const cashPayments = await mongoose.connection.collection('cashpayments')
    .find({
      date: { $gte: targetDate.toISOString().split('T')[0], $lte: targetDate.toISOString().split('T')[0] }
    })
    .toArray();
  console.log(`\nCashPayment: Found ${cashPayments.length} entries on 01/01/2000`);
  if (cashPayments.length > 0) {
    console.log("Sample entries:");
    cashPayments.slice(0, 5).forEach(cp => {
      console.log(`  - ${cp.voucherNo} | Party: ${cp.partyId} | Amount: ${cp.amount} | Status: ${cp.status}`);
    });
  }

  // Check BankPayment collection
  const bankPayments = await mongoose.connection.collection('bankpayments')
    .find({
      date: { $gte: targetDate.toISOString().split('T')[0], $lte: targetDate.toISOString().split('T')[0] }
    })
    .toArray();
  console.log(`\nBankPayment: Found ${bankPayments.length} entries on 01/01/2000`);
  if (bankPayments.length > 0) {
    console.log("Sample entries:");
    bankPayments.slice(0, 5).forEach(bp => {
      console.log(`  - ${bp.voucherNo} | Party: ${bp.partyId} | Amount: ${bp.amount} | Status: ${bp.status}`);
    });
  }

  // Check Journal collection (different from JournalEntry)
  const journals = await mongoose.connection.collection('journals')
    .find({
      date: { $gte: targetDate, $lt: targetDateEnd }
    })
    .toArray();
  console.log(`\nJournal: Found ${journals.length} entries on 01/01/2000`);
  if (journals.length > 0) {
    console.log("Sample entries:");
    journals.slice(0, 5).forEach(j => {
      console.log(`  - ${j.voucherNo} | Type: ${j.type} | Status: ${j.status}`);
    });
  }

  // Check OpeningBalance collection
  const openingBalances = await mongoose.connection.collection('openingbalances')
    .find({})
    .toArray();
  console.log(`\nOpeningBalance: Found ${openingBalances.length} total entries`);
  if (openingBalances.length > 0) {
    console.log("Sample entries:");
    openingBalances.slice(0, 5).forEach(ob => {
      console.log(`  - Type: ${ob.type} | Account: ${ob.accountName} | Item: ${ob.itemName} | Amount: ${ob.amount} | Posted: ${ob.posted}`);
    });
  }

  // Search for entries with opening balance related descriptions
  console.log("\n=== Searching for entries with 'opening' or 'adjustment' in remarks/description ===\n");
  
  const journalEntriesWithOpening = await mongoose.connection.collection('journalentries')
    .find({
      $or: [
        { remarks: { $regex: /opening/i } },
        { remarks: { $regex: /adjustment/i } },
        { remarks: { $regex: /balance/i } },
        { remarks: { $regex: /brought forward/i } }
      ]
    })
    .toArray();
  console.log(`JournalEntry with opening/adjustment remarks: ${journalEntriesWithOpening.length}`);
  if (journalEntriesWithOpening.length > 0) {
    console.log("Sample entries:");
    journalEntriesWithOpening.slice(0, 5).forEach(entry => {
      console.log(`  - ${entry.voucherNo || 'No voucher'} | Date: ${entry.date} | Party: ${entry.partyId} | Debit: ${entry.debit} | Credit: ${entry.credit} | Remarks: ${entry.remarks}`);
    });
  }

  const invoicesWithOpening = await mongoose.connection.collection('invoices')
    .find({
      $or: [
        { notes: { $regex: /opening/i } },
        { notes: { $regex: /adjustment/i } },
        { reference: { $regex: /opening/i } }
      ]
    })
    .toArray();
  console.log(`\nInvoice with opening/adjustment notes: ${invoicesWithOpening.length}`);
  if (invoicesWithOpening.length > 0) {
    console.log("Sample entries:");
    invoicesWithOpening.slice(0, 5).forEach(inv => {
      console.log(`  - ${inv.invoiceNo} | Date: ${inv.date} | Type: ${inv.type} | Party: ${inv.partyId} | Notes: ${inv.notes}`);
    });
  }

  // Check Party collection for openingBalance values
  const partiesWithOpening = await mongoose.connection.collection('parties')
    .find({
      openingBalance: { $exists: true, $ne: 0 }
    })
    .toArray();
  console.log(`\nParty with non-zero openingBalance: ${partiesWithOpening.length}`);
  if (partiesWithOpening.length > 0) {
    console.log("Sample entries:");
    partiesWithOpening.slice(0, 5).forEach(p => {
      console.log(`  - ${p.code} | ${p.name || p.companyName} | Type: ${p.type} | OpeningBalance: ${p.openingBalance} | Balance: ${p.balance}`);
    });
  }

  const totalEntries = journalEntries.length + invoices.length + cashReceipts.length + 
                      bankReceipts.length + cashPayments.length + bankPayments.length + journals.length;
  
  console.log(`\n=== Total entries found on 01/01/2000: ${totalEntries} ===`);

  await mongoose.disconnect();
}

analyze2000Entries().catch(console.error);
