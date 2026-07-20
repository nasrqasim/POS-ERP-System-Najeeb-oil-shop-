import dbConnect from "@/lib/db";
import JournalEntry from "@/models/JournalEntry";
import Invoice from "@/models/Invoice";
import Party from "@/models/Party";
import { recalculatePartyBalance } from "@/services/posting/invoicePostingHelper";

async function cleanup2000Entries() {
  await dbConnect();
  console.log("Connected to MongoDB");

  // Define the target date: 01/01/2000
  const targetDate = new Date("2000-01-01");
  const targetDateEnd = new Date("2000-01-02");

  console.log("\n=== Finding entries dated 01/01/2000 ===");

  // 1. Find and delete JournalEntry records dated 01/01/2000
  const journalEntries = await JournalEntry.find({
    date: {
      $gte: targetDate,
      $lt: targetDateEnd
    }
  }).lean();

  console.log(`Found ${journalEntries.length} JournalEntry records dated 01/01/2000`);

  if (journalEntries.length > 0) {
    // Log the entries for verification
    console.log("\nJournalEntry records to be deleted:");
    journalEntries.forEach((entry: any) => {
      console.log(`  - ${entry.voucherNo} | ${entry.accountTitle} | ${entry.remarks} | Party: ${entry.partyId}`);
    });

    // Delete the journal entries
    const deleteResult = await JournalEntry.deleteMany({
      date: {
        $gte: targetDate,
        $lt: targetDateEnd
      }
    });
    console.log(`\nDeleted ${deleteResult.deletedCount} JournalEntry records`);
  }

  // 2. Find Invoice records dated 01/01/2000 (these might be fake opening entries)
  const invoices = await Invoice.find({
    date: {
      $gte: targetDate,
      $lt: targetDateEnd
    }
  }).lean();

  console.log(`\nFound ${invoices.length} Invoice records dated 01/01/2000`);

  if (invoices.length > 0) {
    // Log the invoices for verification
    console.log("\nInvoice records to be deleted:");
    invoices.forEach((inv: any) => {
      console.log(`  - ${inv.invoiceNo} | ${inv.type} | ${inv.totalAmount} | Party: ${inv.partyId}`);
    });

    // Delete the invoices (these are fake opening entries, not real invoices)
    const deleteResult = await Invoice.deleteMany({
      date: {
        $gte: targetDate,
        $lt: targetDateEnd
      }
    });
    console.log(`\nDeleted ${deleteResult.deletedCount} Invoice records`);
  }

  // 3. Recalculate all customer balances
  console.log("\n=== Recalculating customer balances ===");
  const parties = await Party.find({}).lean();
  let recalcCount = 0;

  for (const party of parties) {
    await recalculatePartyBalance((party as any)._id.toString());
    recalcCount++;
    if (recalcCount % 10 === 0) {
      console.log(`Recalculated ${recalcCount}/${parties.length} parties...`);
    }
  }

  console.log(`\nRecalculated balances for ${recalcCount} parties`);

  console.log("\n=== Cleanup complete ===");
  console.log("Summary:");
  console.log(`- Deleted ${journalEntries.length} JournalEntry records dated 01/01/2000`);
  console.log(`- Deleted ${invoices.length} Invoice records dated 01/01/2000`);
  console.log(`- Recalculated balances for ${recalcCount} parties`);

  process.exit(0);
}

cleanup2000Entries().catch((error) => {
  console.error("Error during cleanup:", error);
  process.exit(1);
});
