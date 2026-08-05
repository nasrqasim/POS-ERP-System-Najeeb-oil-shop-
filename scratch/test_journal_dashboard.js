import mongoose from "mongoose";

const MONGODB_URI = "mongodb+srv://oilshop:Oil%233421@cluster0.68vjmln.mongodb.net/pos_system_db?retryWrites=true&w=majority";

async function main() {
  await mongoose.connect(MONGODB_URI);
  
  const Account = mongoose.model("Account", new mongoose.Schema({}, { strict: false }));
  const Party = mongoose.model("Party", new mongoose.Schema({}, { strict: false }));
  const JournalEntry = mongoose.model("JournalEntry", new mongoose.Schema({}, { strict: false }));
  const Invoice = mongoose.model("Invoice", new mongoose.Schema({}, { strict: false }));

  const targetDateStr = "2026-08-01";
  const startOfDay = new Date(`${targetDateStr}T00:00:00.000Z`);
  const endOfDay = new Date(`${targetDateStr}T23:59:59.999Z`);

  // 1. Sales today (Daily Sales)
  const salesInvoicesTodayRes = await Invoice.aggregate([
    { $match: { type: { $in: ["sale", "non_tax_sale", "challan", "pos"] }, date: { $gte: startOfDay, $lte: endOfDay }, status: { $ne: "cancelled" } } },
    { $group: { _id: null, total: { $sum: "$totalAmount" } } }
  ]);
  const returnsTodayRes = await Invoice.aggregate([
    { $match: { type: { $in: ["sale_return", "non_tax_sale_return"] }, date: { $gte: startOfDay, $lte: endOfDay }, status: { $ne: "cancelled" } } },
    { $group: { _id: null, total: { $sum: "$totalAmount" } } }
  ]);
  const salesToday = (salesInvoicesTodayRes[0]?.total ?? 0) - (returnsTodayRes[0]?.total ?? 0);

  // 2. Cash & Banks
  const cashBankAccs = await Account.find({ type: { $in: ["cash", "bank"] } }).lean();
  const cbCodes = Array.from(new Set(cashBankAccs.map((a) => a.code).concat(["00786", "1111", "1110"])));
  const initialCbOp = cashBankAccs.reduce((s, a) => s + (Number(a.openingBalance) || 0), 0);

  const cbTxBefore = await JournalEntry.aggregate([
    { $match: { accountCode: { $in: cbCodes }, date: { $lt: startOfDay } } },
    { $group: { _id: null, balance: { $sum: { $subtract: ["$debit", "$credit"] } } } }
  ]);
  const cbOpening = initialCbOp + (cbTxBefore[0]?.balance ?? 0);

  const cbRecRes = await JournalEntry.aggregate([
    { $match: { accountCode: { $in: cbCodes }, date: { $gte: startOfDay, $lte: endOfDay } } },
    { $group: { _id: null, total: { $sum: "$debit" } } }
  ]);
  const cbReceipts = Math.round(cbRecRes[0]?.total ?? 0);

  const cbPayRes = await JournalEntry.aggregate([
    { $match: { accountCode: { $in: cbCodes }, date: { $gte: startOfDay, $lte: endOfDay } } },
    { $group: { _id: null, total: { $sum: "$credit" } } }
  ]);
  const cbPayments = Math.round(cbPayRes[0]?.total ?? 0);
  const cbCurrent = cbOpening + cbReceipts - cbPayments;

  // 3. Receivables / Customers
  const customers = await Party.find({ type: "Customer" }).lean();
  const customerIds = customers.map(c => c._id);
  const initialCustOp = customers.reduce((s, c) => s + (Number(c.openingBalance) || 0), 0);

  const recTxBefore = await JournalEntry.aggregate([
    { 
      $match: { 
        date: { $lt: startOfDay },
        $or: [
          { accountCode: "1100" },
          { partyId: { $in: customerIds } }
        ]
      } 
    },
    { $group: { _id: null, balance: { $sum: { $subtract: ["$debit", "$credit"] } } } }
  ]);
  const recOpening = initialCustOp + (recTxBefore[0]?.balance ?? 0);

  const recSlsRes = await JournalEntry.aggregate([
    { 
      $match: { 
        date: { $gte: startOfDay, $lte: endOfDay },
        $or: [
          { accountCode: "1100" },
          { partyId: { $in: customerIds } }
        ]
      } 
    },
    { $group: { _id: null, total: { $sum: "$debit" } } }
  ]);
  const recSalesToday = Math.round(recSlsRes[0]?.total ?? 0);

  const recRcpRes = await JournalEntry.aggregate([
    { 
      $match: { 
        date: { $gte: startOfDay, $lte: endOfDay },
        $or: [
          { accountCode: "1100" },
          { partyId: { $in: customerIds } }
        ]
      } 
    },
    { $group: { _id: null, total: { $sum: "$credit" } } }
  ]);
  const recReceiptsToday = Math.round(recRcpRes[0]?.total ?? 0);
  const recCurrent = recOpening + recSalesToday - recReceiptsToday;

  // 4. Payables / Vendors
  const vendors = await Party.find({ type: "Vendor" }).lean();
  const vendorIds = vendors.map(v => v._id);
  const initialVendOp = vendors.reduce((s, v) => s + (Number(v.openingBalance) || 0), 0);

  const payTxBefore = await JournalEntry.aggregate([
    { 
      $match: { 
        date: { $lt: startOfDay },
        $or: [
          { accountCode: "2100" },
          { partyId: { $in: vendorIds } }
        ]
      } 
    },
    { $group: { _id: null, balance: { $sum: { $subtract: ["$credit", "$debit"] } } } }
  ]);
  const payOpening = initialVendOp + (payTxBefore[0]?.balance ?? 0);

  const payPurRes = await JournalEntry.aggregate([
    { 
      $match: { 
        date: { $gte: startOfDay, $lte: endOfDay },
        $or: [
          { accountCode: "2100" },
          { partyId: { $in: vendorIds } }
        ]
      } 
    },
    { $group: { _id: null, total: { $sum: "$credit" } } }
  ]);
  const payPurchasesToday = Math.round(payPurRes[0]?.total ?? 0);

  const payPmtRes = await JournalEntry.aggregate([
    { 
      $match: { 
        date: { $gte: startOfDay, $lte: endOfDay },
        $or: [
          { accountCode: "2100" },
          { partyId: { $in: vendorIds } }
        ]
      } 
    },
    { $group: { _id: null, total: { $sum: "$debit" } } }
  ]);
  const payPaymentsToday = Math.round(payPmtRes[0]?.total ?? 0);
  const payCurrent = payOpening + payPurchasesToday - payPaymentsToday;

  console.log("==========================================");
  console.log("LIVE DASHBOARD RESULTS FOR DATE:", targetDateStr);
  console.log("==========================================");
  console.log("Sales Today:", salesToday);
  console.log("Cash & Bank:", { opening: Math.round(cbOpening), receipts: cbReceipts, payments: cbPayments, current: Math.round(cbCurrent) });
  console.log("Receivables:", { opening: Math.round(recOpening), sales: recSalesToday, receipts: recReceiptsToday, current: Math.round(recCurrent) });
  console.log("Payables   :", { opening: Math.round(payOpening), purchases: payPurchasesToday, payments: payPaymentsToday, current: Math.round(payCurrent) });

  await mongoose.disconnect();
}

main().catch(console.error);
