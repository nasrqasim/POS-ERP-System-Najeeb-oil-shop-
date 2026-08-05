import fs from "fs";

function parseCustomerHtm() {
  const html = fs.readFileSync("d:/oilshop/customer 17.06.2026.....01.08.2026.htm.html", "utf8");
  
  // Extract rows
  const text = html.replace(/<[^>]+>/g, " | ").replace(/\s+/g, " ");
  
  // Match pattern for customer lines in HTM table
  const lines = html.split(/<TR[^>]*>/i);
  let totalOpening = 0;
  let totalDebit = 0;
  let totalCredit = 0;
  let totalClosing = 0;

  const rows = [];

  for (const l of lines) {
    const cells = l.split(/<TD[^>]*>/i).map(c => c.replace(/<[^>]+>/g, '').trim()).filter(Boolean);
    if (cells.length >= 5) {
      // Look for code, name, opening, debit, credit, closing
      const textRow = cells.join(' :: ');
      if (textRow.includes('Totals') || textRow.includes('Legend')) continue;
      
      // Try to parse numbers from cells
      const nums = cells.map(c => {
        const cleaned = c.replace(/,/g, '').replace(/Debit|Credit/gi, '').trim();
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? null : parsed;
      }).filter(n => n !== null);

      if (nums.length >= 3) {
        rows.push({ cells, nums });
      }
    }
  }

  console.log(`Parsed ${rows.length} row candidates`);
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    console.log(`Row ${i}:`, rows[i].cells);
  }
}

parseCustomerHtm();
