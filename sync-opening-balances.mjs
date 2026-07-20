import mongoose from 'mongoose';

const uri = "mongodb+srv://oilshop:Oil%233421@cluster0.68vjmln.mongodb.net/pos_system_db?retryWrites=true&w=majority";
const fs = await import('fs');

// ============================================================
// PARSE CUSTOMER OPENING BALANCES
// From: customer OPENING BALANCE 17.06.2026  20.07.2026.htm.html
// ============================================================
function parseCustomers(filePath) {
  const html = fs.readFileSync(filePath, 'utf-8');
  const rows = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
  const results = [];
  
  for (let i = 0; i < rows.length; i++) {
    const text = rows[i].replace(/<[^>]*>/g, '|').replace(/\|+/g, '|').trim();
    const m = text.match(/\|(\d{8})\|/);
    if (!m) continue;
    
    const code = m[1];
    const parts = text.split('|').map(x => x.trim()).filter(Boolean);
    const name = parts[1];
    const opValStr = parts.find(p => p.match(/^[\d,]+\.\d{2}$/));
    let openingBalance = opValStr ? parseFloat(opValStr.replace(/,/g, '')) : 0;

    // Next row contains the opening sign
    const nextRow = rows[i+1] || "";
    const nextText = nextRow.replace(/<[^>]*>/g, '|').replace(/\|+/g, '|').trim();
    const nextParts = nextText.split('|').map(x => x.trim()).filter(Boolean);
    const opSign = nextParts.find(p => p === 'Debit' || p === 'Credit');
    
    // For customers: Debit is positive, Credit is negative
    if (opSign === 'Credit') {
      openingBalance = -openingBalance;
    }

    results.push({ code, name, openingBalance });
  }
  return results;
}

// ============================================================
// PARSE VENDOR OPENING BALANCES
// From: OPENING VINDER 17.06.2026  20.07.2026.htm.html
// ============================================================
function parseVendors(filePath) {
  const html = fs.readFileSync(filePath, 'utf-8');
  const rows = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
  const results = [];
  
  for (let i = 0; i < rows.length; i++) {
    const text = rows[i].replace(/<[^>]*>/g, '|').replace(/\|+/g, '|').trim();
    const m = text.match(/\|(\d{8})\|/);
    if (!m) continue;
    
    const code = m[1];
    const parts = text.split('|').map(x => x.trim()).filter(Boolean);
    const name = parts[1];
    const opValStr = parts.find(p => p.match(/^[\d,]+\.\d{2}$/));
    let openingBalance = opValStr ? parseFloat(opValStr.replace(/,/g, '')) : 0;

    // Next row contains the opening sign
    const nextRow = rows[i+1] || "";
    const nextText = nextRow.replace(/<[^>]*>/g, '|').replace(/\|+/g, '|').trim();
    const nextParts = nextText.split('|').map(x => x.trim()).filter(Boolean);
    const opSign = nextParts.find(p => p === 'Debit' || p === 'Credit');
    
    // For vendors: Credit is positive, Debit is negative
    if (opSign === 'Debit') {
      openingBalance = -openingBalance;
    }

    results.push({ code, name, openingBalance });
  }
  return results;
}

// ============================================================
// PARSE CASH IN HAND OPENING BALANCE
// From: CASH HAND 17.06.2026 20.07.2026.htm.html
// Row 6: Balance Brought Forward | 1,649,257.68 | Debit
// ============================================================
function parseCashOpening(filePath) {
  const html = fs.readFileSync(filePath, 'utf-8');
  const rows = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
  
  for (let i = 0; i < rows.length; i++) {
    const text = rows[i].replace(/<[^>]*>/g, '|').replace(/\|+/g, '|').trim();
    if (text.includes('Balance Brought Forward')) {
      const match = text.match(/([\d,]+\.\d{2})/);
      if (match) {
        return parseFloat(match[1].replace(/,/g, ''));
      }
    }
  }
  return null;
}

async function main() {
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
    socketTimeoutMS: 60000,
  });
  const db = mongoose.connection.db;
  
  console.log("=== STEP 1: Parse files ===");
  
  const customers = parseCustomers("D:/oilshop/customer OPENING BALANCE 17.06.2026  20.07.2026.htm.html");
  const vendors = parseVendors("D:/oilshop/OPENING VINDER 17.06.2026  20.07.2026.htm.html");
  const cashOpening = parseCashOpening("D:/oilshop/CASH HAND 17.06.2026 20.07.2026.htm.html");
  
  console.log(`Parsed ${customers.length} customers`);
  console.log(`Parsed ${vendors.length} vendors`);
  console.log(`Cash in Hand opening: ${cashOpening}`);
  
  const custOpSum = customers.reduce((s, c) => s + c.openingBalance, 0);
  const vendOpSum = vendors.reduce((s, v) => s + v.openingBalance, 0);
  console.log(`Customer opening sum: ${custOpSum}`);
  console.log(`Vendor opening sum: ${vendOpSum}`);
  
  // ============================================================
  // STEP 2: Update Customer opening balances
  // ============================================================
  console.log("\n=== STEP 2: Update Customer opening balances ===");
  let custUpdated = 0;
  let custCreated = 0;
  let custNotFound = [];
  
  for (const cust of customers) {
    const existing = await db.collection('parties').findOne({ code: cust.code });
    if (existing) {
      const currentOp = existing.openingBalance || 0;
      if (Math.abs(currentOp - cust.openingBalance) > 0.01) {
        await db.collection('parties').updateOne(
          { code: cust.code },
          { $set: { openingBalance: cust.openingBalance } }
        );
        console.log(`  Updated ${cust.code} ${cust.name}: ${currentOp} -> ${cust.openingBalance}`);
        custUpdated++;
      }
    } else {
      // Create the customer if it doesn't exist
      await db.collection('parties').insertOne({
        code: cust.code,
        name: cust.name,
        companyName: cust.name,
        type: 'Customer',
        openingBalance: cust.openingBalance,
        balance: cust.openingBalance,
        debit: 0,
        credit: 0,
        manualDebit: 0,
        manualCredit: 0,
        creditLimit: 0,
        creditDays: 30,
        status: 'Active',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log(`  Created ${cust.code} ${cust.name} with opening: ${cust.openingBalance}`);
      custCreated++;
    }
  }
  console.log(`Customers: ${custUpdated} updated, ${custCreated} created`);
  
  // ============================================================
  // STEP 3: Update Vendor opening balances
  // ============================================================
  console.log("\n=== STEP 3: Update Vendor opening balances ===");
  let vendUpdated = 0;
  let vendCreated = 0;
  
  for (const vend of vendors) {
    const existing = await db.collection('parties').findOne({ code: vend.code });
    if (existing) {
      const currentOp = existing.openingBalance || 0;
      if (Math.abs(currentOp - vend.openingBalance) > 0.01) {
        await db.collection('parties').updateOne(
          { code: vend.code },
          { $set: { openingBalance: vend.openingBalance } }
        );
        console.log(`  Updated ${vend.code} ${vend.name}: ${currentOp} -> ${vend.openingBalance}`);
        vendUpdated++;
      }
    } else {
      await db.collection('parties').insertOne({
        code: vend.code,
        name: vend.name,
        companyName: vend.name,
        type: 'Vendor',
        openingBalance: vend.openingBalance,
        balance: vend.openingBalance,
        debit: 0,
        credit: 0,
        manualDebit: 0,
        manualCredit: 0,
        creditLimit: 0,
        creditDays: 30,
        status: 'Active',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log(`  Created ${vend.code} ${vend.name} with opening: ${vend.openingBalance}`);
      vendCreated++;
    }
  }
  console.log(`Vendors: ${vendUpdated} updated, ${vendCreated} created`);
  
  // ============================================================
  // STEP 4: Update Cash in Hand account opening balance
  // ============================================================
  console.log("\n=== STEP 4: Update Cash in Hand opening balance ===");
  if (cashOpening !== null) {
    const cashAccount = await db.collection('accounts').findOne({ code: '10001001' });
    if (!cashAccount) {
      // Try other common cash codes
      const cashAccount2 = await db.collection('accounts').findOne({ code: { $in: ['1110', '1111'] } });
      if (cashAccount2) {
        const currentOp = cashAccount2.openingBalance || 0;
        console.log(`  Found cash account ${cashAccount2.code} (${cashAccount2.name}): current opening = ${currentOp}`);
        if (Math.abs(currentOp - cashOpening) > 0.01) {
          await db.collection('accounts').updateOne(
            { _id: cashAccount2._id },
            { $set: { openingBalance: cashOpening } }
          );
          console.log(`  Updated: ${currentOp} -> ${cashOpening}`);
        } else {
          console.log(`  Already correct.`);
        }
      } else {
        console.log(`  No cash account found with code 10001001, 1110, or 1111`);
        // List all accounts
        const allAccounts = await db.collection('accounts').find({ type: { $in: ['cash', 'bank'] } }).toArray();
        console.log(`  Available cash/bank accounts:`);
        for (const acc of allAccounts) {
          console.log(`    ${acc.code} | ${acc.name} | Opening: ${acc.openingBalance}`);
        }
      }
    } else {
      const currentOp = cashAccount.openingBalance || 0;
      console.log(`  Found cash account ${cashAccount.code} (${cashAccount.name}): current opening = ${currentOp}`);
      if (Math.abs(currentOp - cashOpening) > 0.01) {
        await db.collection('accounts').updateOne(
          { code: '10001001' },
          { $set: { openingBalance: cashOpening } }
        );
        console.log(`  Updated: ${currentOp} -> ${cashOpening}`);
      } else {
        console.log(`  Already correct.`);
      }
    }
  }
  
  // ============================================================
  // STEP 5: Verify totals
  // ============================================================
  console.log("\n=== STEP 5: Verify totals after update ===");
  const dbCustomers = await db.collection('parties').find({ type: 'Customer' }).toArray();
  const dbVendors = await db.collection('parties').find({ type: 'Vendor' }).toArray();
  
  const dbCustOpSum = dbCustomers.reduce((s, c) => s + (c.openingBalance || 0), 0);
  const dbVendOpSum = dbVendors.reduce((s, v) => s + (v.openingBalance || 0), 0);
  const dbCustBalSum = dbCustomers.reduce((s, c) => s + (c.balance || 0), 0);
  const dbVendBalSum = dbVendors.reduce((s, v) => s + (v.balance || 0), 0);
  
  console.log(`DB Customers: ${dbCustomers.length} total, Opening sum: ${dbCustOpSum}, Balance sum: ${dbCustBalSum}`);
  console.log(`DB Vendors: ${dbVendors.length} total, Opening sum: ${dbVendOpSum}, Balance sum: ${dbVendBalSum}`);
  
  const cashAccounts = await db.collection('accounts').find({ type: { $in: ['cash', 'bank'] } }).toArray();
  console.log(`Cash/Bank accounts:`);
  for (const acc of cashAccounts) {
    console.log(`  ${acc.code} | ${acc.name} | Opening: ${acc.openingBalance}`);
  }
  
  console.log("\nDone!");
  await mongoose.connection.close();
}

main().catch(err => {
  console.error(err);
  mongoose.connection.close();
});
