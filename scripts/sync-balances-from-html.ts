import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import dbConnect from '../src/lib/db';
import Party from '../src/models/Party';

// Load environment variables from .env.local (in parent directory)
dotenv.config({ path: path.join(process.cwd(), '..', '.env.local') });

interface BalanceData {
  code: string;
  name: string;
  openingBalance: number;
  debit: number;
  credit: number;
  closingBalance: number;
}

function parseHtmlFile(filePath: string): BalanceData[] {
  const html = fs.readFileSync(filePath, 'utf-8');
  const balances: BalanceData[] = [];
  
  // Parse the HTML to extract customer data
  const lines = html.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Look for account code pattern (e.g., 12002002) - must be in a FONT tag
    const codeMatch = line.match(/<FONT[^>]*>(1200\d+)<\/FONT>/);
    if (codeMatch) {
      const code = codeMatch[1];
      
      // Extract all values from this line (code, name, opening balance)
      const fontValues = line.match(/<FONT[^>]*>([^<]+)<\/FONT>/g) || [];
      
      let name = '';
      let openingBalance = 0;
      
      // The pattern is: code, name, opening balance (in ALIGN=RIGHT)
      if (fontValues.length >= 2) {
        name = fontValues[1].replace(/<[^>]*>/g, '').trim();
      }
      
      const openingMatch = line.match(/ALIGN=RIGHT>([\d,]+\.?\d*)/);
      if (openingMatch) {
        openingBalance = parseFloat(openingMatch[1].replace(/,/g, ''));
      }
      
      // Look for debit/credit/closing in subsequent lines
      let debit = 0;
      let credit = 0;
      let closingBalance = 0;
      
      // Next line should have "Debit</CENTER>" and debit/credit values
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        if (nextLine.includes('Debit</CENTER>')) {
          const values = nextLine.match(/ALIGN=RIGHT>([\d,]+\.?\d*)/g);
          if (values && values.length >= 2) {
            debit = parseFloat(values[0].replace(/ALIGN=RIGHT>/g, '').replace(/,/g, ''));
            credit = parseFloat(values[1].replace(/ALIGN=RIGHT>/g, '').replace(/,/g, ''));
          }
        }
      }
      
      // Line after that should have closing balance
      if (i + 2 < lines.length) {
        const closingLine = lines[i + 2];
        const closingMatch = closingLine.match(/ALIGN=RIGHT>([\d,]+\.?\d*)/);
        if (closingMatch) {
          closingBalance = parseFloat(closingMatch[1].replace(/,/g, ''));
        }
      }
      
      if (code && name) {
        balances.push({
          code,
          name,
          openingBalance,
          debit,
          credit,
          closingBalance
        });
      }
    }
  }
  
  return balances;
}

async function syncBalances() {
  await dbConnect();
  
  const openingBalancePath = path.join(process.cwd(), '..', 'OPENING BALANCE 17.06.2026  17.06.2026.htm.html');
  const closingBalancePath = path.join(process.cwd(), '..', 'CLOSING BALANCE 20.07.2026.htm.html');
  
  console.log('Parsing opening balance file...');
  const openingBalances = parseHtmlFile(openingBalancePath);
  console.log(`Found ${openingBalances.length} customers in opening balance file`);
  
  console.log('Parsing closing balance file...');
  const closingBalances = parseHtmlFile(closingBalancePath);
  console.log(`Found ${closingBalances.length} customers in closing balance file`);
  
  // Create a map of closing balances by code
  const closingBalanceMap = new Map<string, BalanceData>();
  closingBalances.forEach(cb => {
    closingBalanceMap.set(cb.code, cb);
  });
  
  let updatedCount = 0;
  let notFoundCount = 0;
  
  for (const opening of openingBalances) {
    const closing = closingBalanceMap.get(opening.code);
    
    if (closing) {
      // Find customer by code
      const party = await Party.findOne({ code: opening.code, type: 'Customer' });
      
      if (party) {
        // Update with closing balance data (most recent)
        const updateData: any = {
          openingBalance: opening.openingBalance,
          debit: closing.debit,
          credit: closing.credit,
          balance: closing.closingBalance
        };
        
        await Party.findByIdAndUpdate(party._id, updateData);
        console.log(`✓ Updated ${opening.code} - ${opening.name}: Opening=${opening.openingBalance}, Debit=${closing.debit}, Credit=${closing.credit}, Closing=${closing.closingBalance}`);
        updatedCount++;
      } else {
        console.log(`✗ Customer not found in MongoDB: ${opening.code} - ${opening.name}`);
        notFoundCount++;
      }
    }
  }
  
  console.log(`\nSync complete:`);
  console.log(`- Updated: ${updatedCount} customers`);
  console.log(`- Not found: ${notFoundCount} customers`);
  
  process.exit(0);
}

syncBalances().catch(err => {
  console.error('Error syncing balances:', err);
  process.exit(1);
});
