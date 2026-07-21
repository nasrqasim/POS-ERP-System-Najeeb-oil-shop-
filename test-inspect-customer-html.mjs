import fs from 'fs';

function inspectCustomerFile(filename) {
  const filePath = `D:/oilshop/${filename}`;
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  console.log(`=== Inspecting ${filename} (length: ${content.length}) ===`);
  
  // Extract all text inside table rows or cells
  const trMatches = content.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
  console.log(`Total TR tags: ${trMatches.length}`);

  trMatches.forEach((tr, idx) => {
    const text = tr.replace(/<[^>]+>/g, '|').replace(/\s+/g, ' ').trim();
    if (text.toLowerCase().includes('total') || text.toLowerCase().includes('21-07') || text.toLowerCase().includes('balance') || idx < 15 || idx > trMatches.length - 15) {
      console.log(`Row ${idx}: ${text}`);
    }
  });
}

inspectCustomerFile('CASTMER 21.07.2026.htm.html');
inspectCustomerFile('CASTEMER   17.06.2026  21.07.2026.htm.html');
