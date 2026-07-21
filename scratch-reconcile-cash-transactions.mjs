import mongoose from 'mongoose';
import fs from 'fs';

const uri = "mongodb+srv://oilshop:Oil%233421@cluster0.68vjmln.mongodb.net/pos_system_db?retryWrites=true&w=majority";

function parseCashLedger(filePath) {
  const html = fs.readFileSync(filePath, 'utf-8');
  const rows = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
  const results = [];
  
  let currentDate = "";
  let currentVoucher = "";
  let currentBuilty = "";
  
  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i].match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
    if (cells.length < 3) continue;
    
    // Check if it's the opening balance row
    const rowText = rows[i].replace(/<[^>]*>/g, '|').replace(/\|+/g, '|').trim();
    if (rowText.includes("Balance Brought Forward")) {
      const match = rowText.match(/([\d,]+\.\d{2})/);
      if (match) {
        results.push({
          type: "OPENING",
          voucherNo: "OPENING",
          description: "Balance Brought Forward",
          debit: 0,
          credit: 0,
          amount: parseFloat(match[1].replace(/,/g, '')),
          balance: parseFloat(match[1].replace(/,/g, ''))
        });
      }
      continue;
    }
    
    // Check if it's a date/voucher header row (e.g. Row 7)
    // Date is usually in TD index 2 or 3
    const dateText = cells[2] ? cells[2].replace(/<[^>]*>/g, '').trim() : "";
    const voucherText = cells[4] ? cells[4].replace(/<[^>]*>/g, '').trim() : "";
    const builtyText = cells[6] ? cells[6].replace(/<[^>]*>/g, '').trim() : "";
    
    if (dateText.match(/^\d{2}-\d{2}-\d{2}$/)) {
      currentDate = dateText;
      currentVoucher = voucherText;
      currentBuilty = builtyText;
      
      // Sometimes this same row has the description and amount if it's single line
      // Let's check if the next row has the description
      const nextRow = rows[i+1] || "";
      const nextCells = nextRow.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
      const nextText = nextRow.replace(/<[^>]*>/g, '|').replace(/\|+/g, '|').trim();
      
      let description = "";
      let debit = 0;
      let credit = 0;
      let runningBalance = 0;
      
      if (nextCells.length > 5 && !nextText.match(/^\d{2}-\d{2}-\d{2}/)) {
        // Description row is the next row
        description = nextCells[7] ? nextCells[7].replace(/<[^>]*>/g, '').trim() : "";
        const debitStr = nextCells[8] ? nextCells[8].replace(/<[^>]*>/g, '').trim() : "";
        const balanceStr = nextCells[11] ? nextCells[11].replace(/<[^>]*>/g, '').trim() : "";
        const signStr = nextCells[12] ? nextCells[12].replace(/<[^>]*>/g, '').trim() : "";
        
        // Debit vs Credit logic:
        // In the cash book, receipts are in the first amount column (Debit PKR), payments in the second column (Credit PKR).
        // Let's check which cell actually has the amount.
        // Let's look at the cells of nextRow:
        const cleanCells = nextCells.map(c => c.replace(/<[^>]*>/g, '').trim());
        
        // Let's find the values
        const nonValIdxs = [];
        const amounts = [];
        for (let j = 0; j < cleanCells.length; j++) {
          const c = cleanCells[j];
          if (c.match(/^[\d,]+\.\d{2}$/)) {
            amounts.push({ index: j, val: parseFloat(c.replace(/,/g, '')) });
          }
        }
        
        if (amounts.length >= 2) {
          // If we have two amounts, the last one is the running balance.
          // The first one is either debit or credit.
          // Let's check cell index to distinguish debit and credit.
          // The debit column is earlier, credit column is later.
          runningBalance = amounts[amounts.length - 1].val;
          const txAmt = amounts[0].val;
          
          // Let's inspect raw HTML cells of nextRow to see where the credit amount is
          // If the TD is empty or not present before the balance, or has a specific COLSPAN.
          // Let's verify by checking the index. In row 8, we had:
          // TD 7 is description: " MAX Customers - Invoice No 7519"
          // TD 8 is debit: "10,000.00"
          // TD 11 is balance: "1,660,207.68"
          // If credit, it will be in TD 9 or 10. Let's see:
          const rawNextRow = nextRow.toUpperCase();
          const parts = rawNextRow.split(/<\/TD>/i);
          let txType = "DEBIT";
          let creditVal = 0;
          let debitVal = 0;
          
          // Count empty TDs or DIV ALIGN=RIGHT before the first amount
          // Wait, if it has a debit amount, there is a TD containing the amount.
          // Let's check how many TDs are empty or align right.
          // A simpler way: we know the previous row's balance.
          // balance_now = balance_prev + debit - credit
          // So txAmt = Math.abs(balance_now - balance_prev).
          // If balance_now > balance_prev, it is a DEBIT (receipt)
          // If balance_now < balance_prev, it is a CREDIT (payment)
          const prevBalance = results.length > 0 ? results[results.length - 1].balance : 1649257.68;
          if (runningBalance > prevBalance) {
            debitVal = txAmt;
            txType = "DEBIT";
          } else {
            creditVal = txAmt;
            txType = "CREDIT";
          }
          
          results.push({
            type: txType,
            date: currentDate,
            voucherNo: currentVoucher,
            builtyNo: currentBuilty,
            description,
            debit: debitVal,
            credit: creditVal,
            balance: runningBalance
          });
        }
      }
    }
  }
  return results;
}

async function main() {
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
  });
  const db = mongoose.connection.db;
  
  console.log("Parsing cash book file...");
  const fileTxs = parseCashLedger("D:/oilshop/CASH  17.06.2026   21.07.2026.htm.html");
  console.log(`Parsed ${fileTxs.length} transactions from cash book file.`);
  
  // Get all cash/bank journal entries from DB
  const cashBankCodes = ["00786", "1111", "1110"];
  const dbTxs = await db.collection('journalentries').find({ 
    accountCode: { $in: cashBankCodes } 
  }).sort({ date: 1, voucherNo: 1 }).toArray();
  
  console.log(`Retrieved ${dbTxs.length} journal entries from DB.`);
  
  // Reconcile
  // Since we want to find why the DB balance is higher by 205,086:
  // Let's find DB transactions that are NOT in the file cash book, or differ in amount!
  console.log("\n=== Checking DB Transactions NOT in File Cash Book ===");
  let unmatchedDbSum = 0;
  
  // Match by voucherNo and amount
  for (const dbTx of dbTxs) {
    const dbAmt = dbTx.debit || dbTx.credit || 0;
    const dbType = dbTx.debit > 0 ? "DEBIT" : "CREDIT";
    
    // Find matching transaction in file
    const match = fileTxs.find(f => {
      if (f.voucherNo === dbTx.voucherNo) {
        const fileAmt = f.debit || f.credit || 0;
        return Math.abs(fileAmt - dbAmt) < 0.01;
      }
      return false;
    });
    
    if (!match) {
      console.log(`Unmatched DB: ${dbTx.voucherNo} | Date: ${dbTx.date.toISOString().slice(0,10)} | Type: ${dbType} | Amt: ${dbAmt} | Remarks: ${dbTx.remarks}`);
      unmatchedDbSum += (dbType === "DEBIT" ? dbAmt : -dbAmt);
    }
  }
  console.log(`Sum of unmatched DB transactions: ${unmatchedDbSum}`);
  
  console.log("\n=== Checking File Transactions NOT in DB ===");
  let unmatchedFileSum = 0;
  for (const f of fileTxs) {
    if (f.voucherNo === "OPENING") continue;
    const fAmt = f.debit || f.credit || 0;
    const fType = f.debit > 0 ? "DEBIT" : "CREDIT";
    
    const match = dbTxs.find(d => {
      if (d.voucherNo === f.voucherNo) {
        const dbAmt = d.debit || d.credit || 0;
        return Math.abs(dbAmt - fAmt) < 0.01;
      }
      return false;
    });
    
    if (!match) {
      console.log(`Unmatched File: ${f.voucherNo} | Date: ${f.date} | Type: ${fType} | Amt: ${fAmt} | Desc: ${f.description}`);
      unmatchedFileSum += (fType === "DEBIT" ? fAmt : -fAmt);
    }
  }
  console.log(`Sum of unmatched File transactions: ${unmatchedFileSum}`);
  
  await mongoose.connection.close();
}

main().catch(err => {
  console.error(err);
  mongoose.connection.close();
});
