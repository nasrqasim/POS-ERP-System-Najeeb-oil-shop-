import mongoose from "mongoose";

const MONGODB_URI = "mongodb+srv://oilshop:Oil%233421@cluster0.68vjmln.mongodb.net/pos_system_db?retryWrites=true&w=majority";

async function main() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;

  const targetDateStr = "2026-08-01";
  const baselineDateStr = "2026-08-01";

  function getDayStr(d) {
    if (!d) return "";
    const dateObj = new Date(d);
    if (isNaN(dateObj.getTime())) return "";
    return dateObj.toISOString().slice(0, 10);
  }

  const allParties = await db.collection("parties").find({ status: "Active" }).toArray();
  const allInvoices = await db.collection("invoices").find({ status: { $ne: "cancelled" } }).toArray();
  const allCR = await db.collection("cashreceipts").find({}).toArray();
  const allBR = await db.collection("bankreceipts").find({}).toArray();
  const allCP = await db.collection("cashpayments").find({}).toArray();
  const allBP = await db.collection("bankpayments").find({}).toArray();

  const customers = allParties.filter(p => p.type === "Customer");
  const vendors = allParties.filter(p => p.type === "Vendor");
  const customerIds = new Set(customers.map(c => String(c._id)));
  const vendorIds = new Set(vendors.map(v => String(v._id)));

  // 1. Sales today
  const salesInvoicesToday = allInvoices.filter(i => 
    ["sale", "non_tax_sale", "challan", "pos"].includes(i.type) && getDayStr(i.date || i.createdAt) === targetDateStr
  );
  const returnsInvoicesToday = allInvoices.filter(i => 
    ["sale_return", "non_tax_sale_return"].includes(i.type) && getDayStr(i.date || i.createdAt) === targetDateStr
  );
  const salesToday = (salesInvoicesToday.reduce((s, i) => s + (Number(i.totalAmount) || 0), 0)) -
                     (returnsInvoicesToday.reduce((s, i) => s + (Number(i.totalAmount) || 0), 0));

  // 2. RECEIVABLES (Customers)
  let recSalesDebitsToday = 0;
  salesInvoicesToday.forEach(i => {
    const total = Number(i.totalAmount) || 0;
    const isPaid = i.paymentMethod === "Cash" || i.paymentMethod === "Bank" || i.status === "paid" || i.balance === 0;
    const paidAtCreation = isPaid ? total : ((Number(i.amountReceived) > 0 ? Number(i.amountReceived) : 0) || (Number(i.amountPaid) > 0 ? Number(i.amountPaid) : 0));
    recSalesDebitsToday += Math.max(0, total - paidAtCreation);
  });

  let recReceiptsCreditsToday = 0;
  allCR.forEach(r => {
    const pid = String(r.partyId?._id || r.partyId || r.party || "");
    if (customerIds.has(pid) && getDayStr(r.date || r.createdAt) === targetDateStr) {
      recReceiptsCreditsToday += Number(r.amount) || 0;
    }
  });
  allBR.forEach(r => {
    const pid = String(r.partyId?._id || r.partyId || r.party || "");
    if (customerIds.has(pid) && getDayStr(r.date || r.createdAt) === targetDateStr) {
      recReceiptsCreditsToday += Number(r.amount) || 0;
    }
  });

  // Calculate dynamic Receivables Opening from baseline
  let recOpening = 4610221;
  if (targetDateStr > baselineDateStr) {
    allInvoices.forEach(i => {
      const dStr = getDayStr(i.date || i.createdAt);
      if (dStr >= baselineDateStr && dStr < targetDateStr) {
        if (["sale", "non_tax_sale", "challan", "pos"].includes(i.type)) {
          const total = Number(i.totalAmount) || 0;
          const isPaid = i.paymentMethod === "Cash" || i.paymentMethod === "Bank" || i.status === "paid" || i.balance === 0;
          const paidAtCreation = isPaid ? total : ((Number(i.amountReceived) > 0 ? Number(i.amountReceived) : 0) || (Number(i.amountPaid) > 0 ? Number(i.amountPaid) : 0));
          recOpening += Math.max(0, total - paidAtCreation);
        } else if (["sale_return", "non_tax_sale_return"].includes(i.type)) {
          recOpening -= Number(i.totalAmount) || 0;
        }
      }
    });
    allCR.forEach(r => {
      const pid = String(r.partyId?._id || r.partyId || r.party || "");
      const dStr = getDayStr(r.date || r.createdAt);
      if (customerIds.has(pid) && dStr >= baselineDateStr && dStr < targetDateStr) {
        recOpening -= Number(r.amount) || 0;
      }
    });
    allBR.forEach(r => {
      const pid = String(r.partyId?._id || r.partyId || r.party || "");
      const dStr = getDayStr(r.date || r.createdAt);
      if (customerIds.has(pid) && dStr >= baselineDateStr && dStr < targetDateStr) {
        recOpening -= Number(r.amount) || 0;
      }
    });
  }

  const recCurrent = recOpening + recSalesDebitsToday - recReceiptsCreditsToday;

  // 3. PAYABLES (Vendors)
  const purchaseInvoicesToday = allInvoices.filter(i => 
    ["purchase", "non_tax_purchase", "import_purchase"].includes(i.type) && getDayStr(i.date || i.createdAt) === targetDateStr
  );
  const payPurchasesCreditsToday = purchaseInvoicesToday.reduce((s, i) => s + (Number(i.totalAmount) || 0), 0);

  let payPaymentsDebitsToday = 0;
  allCP.forEach(p => {
    const pid = String(p.partyId?._id || p.partyId || p.vendor || "");
    if (vendorIds.has(pid) && getDayStr(p.date || p.createdAt) === targetDateStr) {
      payPaymentsDebitsToday += Number(p.amount) || 0;
    }
  });
  allBP.forEach(p => {
    const pid = String(p.vendor || p.partyId || "");
    if (vendorIds.has(pid) && getDayStr(p.date || p.createdAt) === targetDateStr) {
      payPaymentsDebitsToday += Number(p.amount) || 0;
    }
  });
  purchaseInvoicesToday.forEach(i => {
    const total = Number(i.totalAmount) || 0;
    const rawPaid = (Number(i.amountReceived) > 0 ? Number(i.amountReceived) : 0) ||
                    (Number(i.amountPaid) > 0 ? Number(i.amountPaid) : 0) ||
                    ((i.paymentMethod === "Cash" || i.paymentMethod === "Bank" || i.status === "paid" || i.balance === 0) ? total : 0);
    if (rawPaid > 0 && payPaymentsDebitsToday === 0) {
      payPaymentsDebitsToday += rawPaid;
    }
  });

  let payOpening = 2606292;
  if (targetDateStr > baselineDateStr) {
    allInvoices.forEach(i => {
      const dStr = getDayStr(i.date || i.createdAt);
      if (dStr >= baselineDateStr && dStr < targetDateStr) {
        if (["purchase", "non_tax_purchase", "import_purchase"].includes(i.type)) {
          payOpening += Number(i.totalAmount) || 0;
        } else if (["purchase_return", "non_tax_purchase_return"].includes(i.type)) {
          payOpening -= Number(i.totalAmount) || 0;
        }
      }
    });
    allCP.forEach(p => {
      const pid = String(p.partyId?._id || p.partyId || p.vendor || "");
      const dStr = getDayStr(p.date || p.createdAt);
      if (vendorIds.has(pid) && dStr >= baselineDateStr && dStr < targetDateStr) {
        payOpening -= Number(p.amount) || 0;
      }
    });
    allBP.forEach(p => {
      const pid = String(p.vendor || p.partyId || "");
      const dStr = getDayStr(p.date || p.createdAt);
      if (vendorIds.has(pid) && dStr >= baselineDateStr && dStr < targetDateStr) {
        payOpening -= Number(p.amount) || 0;
      }
    });
  }

  const payCurrent = payOpening + payPurchasesCreditsToday - payPaymentsDebitsToday;

  // 4. CASH & BANKS
  let cbReceiptsToday = recReceiptsCreditsToday;
  salesInvoicesToday.forEach(i => {
    const total = Number(i.totalAmount) || 0;
    const isPaid = i.paymentMethod === "Cash" || i.paymentMethod === "Bank" || i.status === "paid" || i.balance === 0;
    const paidAtCreation = isPaid ? total : ((Number(i.amountReceived) > 0 ? Number(i.amountReceived) : 0) || (Number(i.amountPaid) > 0 ? Number(i.amountPaid) : 0));
    cbReceiptsToday += Math.min(total, paidAtCreation);
  });

  let cbPaymentsToday = payPaymentsDebitsToday;
  allCP.forEach(p => {
    const pid = String(p.partyId?._id || p.partyId || p.vendor || "");
    if (!vendorIds.has(pid) && getDayStr(p.date || p.createdAt) === targetDateStr) {
      cbPaymentsToday += Number(p.amount) || 0;
    }
  });

  let cbOpening = 1807983;
  if (targetDateStr > baselineDateStr) {
    allCR.forEach(r => {
      const dStr = getDayStr(r.date || r.createdAt);
      if (dStr >= baselineDateStr && dStr < targetDateStr) {
        cbOpening += Number(r.amount) || 0;
      }
    });
    allBR.forEach(r => {
      const dStr = getDayStr(r.date || r.createdAt);
      if (dStr >= baselineDateStr && dStr < targetDateStr) {
        cbOpening += Number(r.amount) || 0;
      }
    });
    allCP.forEach(p => {
      const dStr = getDayStr(p.date || p.createdAt);
      if (dStr >= baselineDateStr && dStr < targetDateStr) {
        cbOpening -= Number(p.amount) || 0;
      }
    });
    allBP.forEach(p => {
      const dStr = getDayStr(p.date || p.createdAt);
      if (dStr >= baselineDateStr && dStr < targetDateStr) {
        cbOpening -= Number(p.amount) || 0;
      }
    });
  }

  const cbCurrent = cbOpening + cbReceiptsToday - cbPaymentsToday;

  console.log("=== FINAL ROUTE TEST OUTPUT ===");
  console.log("Sales Today:", Math.round(salesToday));
  console.log("Cash & Bank -> Opening:", Math.round(cbOpening), "| Receipts:", Math.round(cbReceiptsToday), "| Payments:", Math.round(cbPaymentsToday), "| Current:", Math.round(cbCurrent));
  console.log("Receivables -> Opening:", Math.round(recOpening), "| Sales (Debits):", Math.round(recSalesDebitsToday), "| Receipts (Credits):", Math.round(recReceiptsCreditsToday), "| Current:", Math.round(recCurrent));
  console.log("Payables    -> Opening:", Math.round(payOpening), "| Purchases (Credits):", Math.round(payPurchasesCreditsToday), "| Payments (Debits):", Math.round(payPaymentsDebitsToday), "| Current:", Math.round(payCurrent));

  await mongoose.disconnect();
}

main().catch(console.error);
