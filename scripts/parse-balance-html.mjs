import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseHTMLFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return [];
  }
  
  const html = fs.readFileSync(filePath, 'utf-8');
  const customers = [];
  
  // Parse HTML line by line - customer data is in 3-row blocks
  const lines = html.split('\n');
  
  for (let i = 0; i < lines.length - 2; i++) {
    const line1 = lines[i];
    const line2 = lines[i + 1];
    const line3 = lines[i + 2];
    
    // Check if this is the start of a customer block (has 8-digit code)
    const codeMatch = line1.match(/(\d{8})/);
    if (!codeMatch) continue;
    
    const code = codeMatch[1];
    
    // Extract name from line 1
    const nameMatch = line1.match(/<FONT FACE="Arial" SIZE=1>([^<]+)<\/FONT>/g);
    if (!nameMatch || nameMatch.length < 2) continue;
    const name = nameMatch[1].replace(/<FONT FACE="Arial" SIZE=1>|<\/FONT>/g, '').trim();
    if (!name || name.match(/^\d+$/)) continue;
    
    // Extract opening balance from line 1
    const openingMatch = line1.match(/<DIV ALIGN=RIGHT>([\d,]+\.?\d*)<\/DIV>/);
    const openingBalance = openingMatch ? parseFloat(openingMatch[1].replace(/,/g, '')) : 0;
    
    // Extract debit from line 2
    const debitMatch = line2.match(/<DIV ALIGN=RIGHT>([\d,]+\.?\d*)<\/DIV>/);
    const debit = debitMatch ? parseFloat(debitMatch[1].replace(/,/g, '')) : 0;
    
    // Extract credit from line 2 (second DIV ALIGN=RIGHT)
    const creditMatches = line2.match(/<DIV ALIGN=RIGHT>([\d,]+\.?\d*)<\/DIV>/g);
    const credit = creditMatches && creditMatches.length > 1 ? parseFloat(creditMatches[1].replace(/,/g, '').replace(/<DIV ALIGN=RIGHT>|<\/FONT><\/DIV>/g, '')) : 0;
    
    // Extract closing balance from line 3
    const closingMatch = line3.match(/<DIV ALIGN=RIGHT>([\d,]+\.?\d*)<\/DIV>/);
    const closingBalance = closingMatch ? parseFloat(closingMatch[1].replace(/,/g, '')) : 0;
    
    customers.push({
      code,
      name,
      openingBalance,
      debit,
      credit,
      closingBalance
    });
    
    // Skip the next 2 lines since we processed them
    i += 2;
  }
  
  return customers;
}

// Parse both files
const openingBalancePath = path.join(__dirname, '../../OPENING BALANCE 17.06.2026  17.06.2026.htm.html');
const closingBalancePath = path.join(__dirname, '../../CLOSING BALANCE 20.07.2026.htm.html');

console.log('Parsing Opening Balance file...');
const openingBalances = parseHTMLFile(openingBalancePath);
console.log(`Found ${openingBalances.length} customers in Opening Balance file`);

console.log('\nParsing Closing Balance file...');
const closingBalances = parseHTMLFile(closingBalancePath);
console.log(`Found ${closingBalances.length} customers in Closing Balance file`);

// Create a map of opening balances by code
const openingBalanceMap = new Map();
openingBalances.forEach(c => {
  openingBalanceMap.set(c.code, c.openingBalance);
});

// Create a map of closing balances by code
const closingBalanceMap = new Map();
closingBalances.forEach(c => {
  closingBalanceMap.set(c.code, c.closingBalance);
});

// Merge data
const mergedData = openingBalances.map(ob => {
  const cb = closingBalances.find(c => c.code === ob.code);
  return {
    code: ob.code,
    name: ob.name,
    openingBalance: ob.openingBalance,
    closingBalance: cb?.closingBalance || 0
  };
});

// Add customers only in closing balance
closingBalances.forEach(cb => {
  if (!mergedData.find(m => m.code === cb.code)) {
    mergedData.push({
      code: cb.code,
      name: cb.name,
      openingBalance: 0,
      closingBalance: cb.closingBalance
    });
  }
});

// Output as JSON
const outputPath = path.join(__dirname, '../../customer-balances-extracted.json');
fs.writeFileSync(outputPath, JSON.stringify(mergedData, null, 2));
console.log(`\nExtracted data saved to: ${outputPath}`);
console.log(`Total customers: ${mergedData.length}`);

// Display sample data
console.log('\nSample data (first 5 customers):');
console.log(JSON.stringify(mergedData.slice(0, 5), null, 2));
