import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface CustomerBalance {
  code: string;
  name: string;
  openingBalance: number;
  debit: number;
  credit: number;
  closingBalance: number;
}

function parseHTMLFile(filePath: string): CustomerBalance[] {
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return [];
  }
  
  const html = fs.readFileSync(filePath, 'utf-8');
  const customers: CustomerBalance[] = [];
  
  // Parse HTML to extract customer data using regex
  // Pattern to match customer blocks
  const customerPattern = /<TR><TD HEIGHT=15><\/TD><TD><\/TD><TD COLSPAN=2 NOWRAP VALIGN=TOP><FONT FACE="Arial" SIZE=1>(\d+)<\/FONT><\/TD><TD NOWRAP VALIGN=TOP><FONT FACE="Arial" SIZE=1>([^<]+)<\/FONT><\/TD><TD COLSPAN=2 NOWRAP VALIGN=TOP><FONT FACE="Arial" SIZE=1><DIV ALIGN=RIGHT>([\d,]+\.?\d*)<\/DIV><\/FONT><\/TD><\/TR>\s*<TR><TD HEIGHT=15><\/TD><TD><\/TD><TD><\/TD><TD><\/TD><TD><\/TD><TD><\/TD><TD><\/TD><TD COLSPAN=2 NOWRAP VALIGN=TOP><FONT FACE="Arial" SIZE=1><CENTER>(Debit|Credit)<\/CENTER><\/FONT><\/TD><TD COLSPAN=3 NOWRAP VALIGN=TOP><FONT FACE="Arial" SIZE=1><DIV ALIGN=RIGHT>([\d,]+\.?\d*)<\/DIV><\/FONT><\/TD><TD><\/TD><TD COLSPAN=3 NOWRAP VALIGN=TOP><FONT FACE="Arial" SIZE=1><DIV ALIGN=RIGHT>([\d,]+\.?\d*)<\/DIV><\/FONT><\/TD><\/TR>\s*<TR><TD HEIGHT=15><\/TD><TD><\/TD><TD><\/TD><TD><\/TD><TD><\/TD><TD><\/TD><TD><\/TD><TD><\/TD><TD><\/TD><TD><\/TD><TD><\/TD><TD><\/TD><TD><\/TD><TD COLSPAN=3 NOWRAP VALIGN=TOP><FONT FACE="Arial" SIZE=1><DIV ALIGN=RIGHT>([\d,]+\.?\d*)<\/DIV><\/FONT><\/TD><\/TR>/g;
  
  let match;
  while ((match = customerPattern.exec(html)) !== null) {
    const customer: CustomerBalance = {
      code: match[1],
      name: match[2].trim(),
      openingBalance: parseFloat(match[3].replace(/,/g, '')),
      debit: parseFloat(match[5].replace(/,/g, '')),
      credit: parseFloat(match[6].replace(/,/g, '')),
      closingBalance: parseFloat(match[7].replace(/,/g, ''))
    };
    customers.push(customer);
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
const openingBalanceMap = new Map<string, number>();
openingBalances.forEach(c => {
  openingBalanceMap.set(c.code, c.openingBalance);
});

// Create a map of closing balances by code
const closingBalanceMap = new Map<string, number>();
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
