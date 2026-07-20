import mongoose from 'mongoose';

const MONGODB_URI = "mongodb+srv://oilshop:Oil%233421@cluster0.68vjmln.mongodb.net/pos_system_db?retryWrites=true&w=majority";

async function cleanupOpeningBalances() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB!");

  const Party = mongoose.connection.collection('parties');
  const Invoice = mongoose.connection.collection('invoices');
  const CashReceipt = mongoose.connection.collection('cashreceipts');
  const BankReceipt = mongoose.connection.collection('bankreceipts');
  const CashPayment = mongoose.connection.collection('cashpayments');
  const BankPayment = mongoose.connection.collection('bankpayments');

  console.log("\n=== Step 1: Finding parties with non-zero openingBalance ===");
  const partiesWithOpening = await Party.find({
    openingBalance: { $exists: true, $ne: 0 }
  }).toArray();
  console.log(`Found ${partiesWithOpening.length} parties with non-zero openingBalance`);

  console.log("\n=== Step 2: Setting openingBalance to 0 for all parties ===");
  const updateResult = await Party.updateMany(
    { openingBalance: { $exists: true } },
    { $set: { openingBalance: 0, manualDebit: 0, manualCredit: 0 } }
  );
  console.log(`Updated ${updateResult.modifiedCount} parties`);

  console.log("\n=== Step 3: Recalculating balances for all parties ===");
  const allParties = await Party.find({}).toArray();
  console.log(`Processing ${allParties.length} parties...`);

  let processedCount = 0;
  let errorCount = 0;

  for (const party of allParties) {
    try {
      const partyId = party._id;
      const isCustomer = party.type === "Customer";

      // Get all transactions for this party
      const invoices = await Invoice.find({
        partyId: partyId,
        status: { $ne: "cancelled" }
      }).toArray();

      const cashReceipts = await CashReceipt.find({
        $or: [
          { partyId: partyId },
          { party: String(partyId) }
        ],
        status: "Posted"
      }).toArray();

      const bankReceipts = await BankReceipt.find({
        party: String(partyId),
        status: { $in: ["Posted", "Cleared"] }
      }).toArray();

      const cashPayments = await CashPayment.find({
        $or: [
          { partyId: partyId },
          { vendor: String(partyId) }
        ],
        status: "Posted"
      }).toArray();

      const bankPayments = await BankPayment.find({
        vendor: String(partyId),
        status: "Posted"
      }).toArray();

      // Calculate totals based on party type
      let totalDebit = 0;
      let totalCredit = 0;

      if (isCustomer) {
        // Customer: Sales increase debit (receivable), Returns increase credit, Receipts increase credit
        invoices.forEach(inv => {
          const isReturn = inv.type === "sale_return" || inv.type === "non_tax_sale_return";
          if (isReturn) {
            totalCredit += inv.totalAmount || 0;
          } else {
            totalDebit += inv.totalAmount || 0;
          }
        });

        cashReceipts.forEach(cr => {
          totalCredit += cr.amount || 0;
        });

        bankReceipts.forEach(br => {
          totalCredit += br.amount || 0;
        });

        cashPayments.forEach(cp => {
          totalDebit += cp.amount || 0;
        });

        bankPayments.forEach(bp => {
          totalDebit += bp.amount || 0;
        });

        // Customer balance = debit - credit (positive = receivable)
        const balance = totalDebit - totalCredit;

        await Party.updateOne(
          { _id: partyId },
          { $set: { debit: totalDebit, credit: totalCredit, balance: balance } }
        );

      } else {
        // Vendor: Purchases increase credit (payable), Returns increase debit, Payments increase debit
        invoices.forEach(inv => {
          const isReturn = inv.type === "purchase_return" || inv.type === "non_tax_purchase_return";
          if (isReturn) {
            totalDebit += inv.totalAmount || 0;
          } else {
            totalCredit += inv.totalAmount || 0;
          }
        });

        cashPayments.forEach(cp => {
          totalDebit += cp.amount || 0;
        });

        bankPayments.forEach(bp => {
          totalDebit += bp.amount || 0;
        });

        cashReceipts.forEach(cr => {
          totalCredit += cr.amount || 0;
        });

        bankReceipts.forEach(br => {
          totalCredit += br.amount || 0;
        });

        // Vendor balance = credit - debit (positive = payable)
        const balance = totalCredit - totalDebit;

        await Party.updateOne(
          { _id: partyId },
          { $set: { debit: totalDebit, credit: totalCredit, balance: balance } }
        );
      }

      processedCount++;
      if (processedCount % 50 === 0) {
        console.log(`Processed ${processedCount}/${allParties.length} parties...`);
      }

    } catch (error) {
      console.error(`Error processing party ${party._id}:`, error);
      errorCount++;
    }
  }

  console.log(`\n=== Balance Recalculation Complete ===`);
  console.log(`Successfully processed: ${processedCount} parties`);
  console.log(`Errors: ${errorCount} parties`);

  // Verify the cleanup
  console.log("\n=== Verification ===");
  const remainingOpening = await Party.find({
    openingBalance: { $exists: true, $ne: 0 }
  }).countDocuments();
  console.log(`Parties with non-zero openingBalance after cleanup: ${remainingOpening}`);

  const sampleParties = await Party.find({}).limit(5).toArray();
  console.log("\nSample party balances after recalculation:");
  sampleParties.forEach(p => {
    console.log(`- ${p.code} | ${p.name || p.companyName} | Type: ${p.type} | Opening: ${p.openingBalance} | Debit: ${p.debit} | Credit: ${p.credit} | Balance: ${p.balance}`);
  });

  await mongoose.disconnect();
  console.log("\n=== Cleanup Complete ===");
}

cleanupOpeningBalances().catch(console.error);
