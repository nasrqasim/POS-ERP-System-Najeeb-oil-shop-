import mongoose from 'mongoose';

const uri = "mongodb+srv://oilshop:Oil%233421@cluster0.68vjmln.mongodb.net/pos_system_db?retryWrites=true&w=majority";

async function main() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  
  const targetDate = new Date("2026-07-20");
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);
  
  const salesInvoices = await db.collection('invoices').find({ 
    type: { $in: ["sale", "non_tax_sale", "challan"] }, 
    date: { $gte: startOfDay, $lte: endOfDay }, 
    status: { $ne: "cancelled" } 
  }).toArray();
  
  const posSales = await db.collection('invoices').find({ 
    type: "pos", 
    date: { $gte: startOfDay, $lte: endOfDay }, 
    status: { $ne: "cancelled" } 
  }).toArray();
  
  const returns = await db.collection('invoices').find({ 
    type: { $in: ["sale_return", "non_tax_sale_return"] }, 
    date: { $gte: startOfDay, $lte: endOfDay }, 
    status: { $ne: "cancelled" } 
  }).toArray();
  
  const saleInvoiceTotal = salesInvoices.reduce((s, i) => s + (i.totalAmount || 0), 0);
  const posSalesTotal = posSales.reduce((s, i) => s + (i.totalAmount || 0), 0);
  const returnTotal = returns.reduce((s, i) => s + (i.totalAmount || 0), 0);
  
  console.log("Sales Invoices count:", salesInvoices.length, "Total:", saleInvoiceTotal);
  console.log("POS Sales count:", posSales.length, "Total:", posSalesTotal);
  console.log("Returns count:", returns.length, "Total:", returnTotal);
  
  const calculatedSales = (saleInvoiceTotal + posSalesTotal) - returnTotal;
  console.log("Calculated sales today:", calculatedSales);
  
  await mongoose.connection.close();
}

main().catch(err => {
  console.error(err);
  mongoose.connection.close();
});
