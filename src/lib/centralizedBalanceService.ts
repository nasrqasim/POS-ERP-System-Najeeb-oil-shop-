/**
 * Centralized Party (Vendor & Customer) Live Balance & Inventory Service
 * Single Source of Truth across all ERP Pages & Reports.
 * Implements business logic defined in docs/BUSINESS_LOGIC_MAP.md
 */

export interface PartyTransaction {
  date: Date;
  debit: number;
  credit: number;
  description?: string;
  voucherNo?: string;
  type?: string;
  runningBalance?: number;
}

/**
 * Standardize entity ID matching (handles string, object, or name fallback)
 */
export function matchesEntity(ref: any, targetId: string, targetName?: string): boolean {
  if (!ref && !targetId && !targetName) return false;
  if (ref) {
    if (typeof ref === "object") {
      const id = String(ref._id || ref.id || "");
      if (id && id === targetId) return true;
      const name = String(ref.name || ref.companyName || "");
      if (targetName && name && name.toLowerCase() === targetName.toLowerCase()) return true;
    } else {
      const s = String(ref);
      if (s === targetId) return true;
      if (targetName && s.toLowerCase() === targetName.toLowerCase()) return true;
    }
  }
  return false;
}

/**
 * Calculate live Vendor Net Balance (Credits = Purchases/Receipts, Debits = Payments/Returns)
 * Natural Balance: Credit (positive = Dokan owes Vendor)
 */
export function calculateVendorBalance(
  vendor: any,
  invoices: any[],
  cashPayments: any[],
  bankPayments: any[],
  cashReceipts: any[] = [],
  bankReceipts: any[] = [],
  toDate?: string | Date
) {
  const partyId = String(vendor._id || vendor.id || "");
  const vendorName = String(vendor.companyName || vendor.name || "");
  const initialOpening = Number(vendor.openingBalance) || 0;

  const toDateTime = toDate ? new Date(toDate).getTime() : Infinity;

  const pInvoices = invoices.filter((inv: any) => 
    matchesEntity(inv.partyId || inv.vendorId || inv.vendor, partyId, vendorName)
  );
  const pCashPayments = cashPayments.filter((py: any) => 
    matchesEntity(py.partyId || py.vendor || py.vendorId, partyId, vendorName) && py.status !== "Cancelled"
  );
  const pBankPayments = bankPayments.filter((py: any) => 
    matchesEntity(py.partyId || py.vendor || py.vendorId, partyId, vendorName) && py.status !== "Cancelled"
  );
  const pCashReceipts = cashReceipts.filter((r: any) => 
    matchesEntity(r.partyId || r.party || r.vendor, partyId, vendorName) && r.status !== "Cancelled"
  );
  const pBankReceipts = bankReceipts.filter((r: any) => 
    matchesEntity(r.partyId || r.party || r.vendor, partyId, vendorName) && r.status !== "Cancelled"
  );

  const txs: PartyTransaction[] = [];

  pInvoices.forEach((s: any) => {
    if (s.status === "cancelled" || s.status === "Cancelled") return;
    const isReturn = s.type === "purchase_return" || s.type === "non_tax_purchase_return";
    if (["purchase", "non_tax_purchase", "import_purchase", "purchase_return", "non_tax_purchase_return"].includes(s.type)) {
      const totalAmt = Number(s.totalAmount) || 0;
      let paidAtCreation = 0;
      if (!isReturn) {
        const invNo = s.invoiceNo || "";
        const linkedCashAmt = invNo ? pCashPayments
          .filter((py: any) => py.reference === invNo || py.invoiceId === s._id || (py.narration && String(py.narration).toLowerCase().includes(invNo.toLowerCase())))
          .reduce((sum: number, py: any) => sum + (Number(py.amount) || 0), 0) : 0;
        const linkedBankAmt = invNo ? pBankPayments
          .filter((py: any) => py.instrumentNo === invNo || py.invoiceId === s._id || (py.narration && String(py.narration).toLowerCase().includes(invNo.toLowerCase())))
          .reduce((sum: number, py: any) => sum + (Number(py.amount) || 0), 0) : 0;

        const isCredit = (s.paymentMethod || "").toLowerCase() === "credit" || s.isCreditBill;
        let rawPaid = 0;
        if (isCredit) {
          rawPaid = Number(s.amountReceived) || Number(s.amountPaid) || 0;
        } else {
          const isExplicitPaid = (s.paymentMethod || "").toLowerCase() === "cash" || (s.paymentMethod || "").toLowerCase() === "bank" || s.status === "paid" || s.balance === 0;
          rawPaid = isExplicitPaid ? totalAmt : (Number(s.amountReceived) || Number(s.amountPaid) || 0);
        }

        paidAtCreation = Math.max(0, rawPaid - (linkedCashAmt + linkedBankAmt));
      }

      txs.push({
        date: new Date(s.date || s.createdAt),
        debit: isReturn ? totalAmt : paidAtCreation,
        credit: isReturn ? 0 : totalAmt,
        voucherNo: s.invoiceNo,
        type: isReturn ? "Purchase Return" : "Purchase Invoice",
        description: s.notes || s.remarks || (isReturn ? "Purchase Return" : "Purchase Bill")
      });
    }
  });

  pCashPayments.forEach((py: any) => {
    txs.push({
      date: new Date(py.date || py.createdAt),
      debit: Number(py.amount) || 0,
      credit: 0,
      voucherNo: py.voucherNo || py.receiptNumber,
      type: "Cash Payment",
      description: py.narration || py.remarks || "Vendor Cash Payment"
    });
  });

  pBankPayments.forEach((py: any) => {
    txs.push({
      date: new Date(py.date || py.createdAt),
      debit: Number(py.amount) || 0,
      credit: 0,
      voucherNo: py.voucherNo || py.chequeNo || py.instrumentNo,
      type: "Bank Payment",
      description: py.narration || py.remarks || "Vendor Bank Payment"
    });
  });

  pCashReceipts.forEach((r: any) => {
    txs.push({
      date: new Date(r.date || r.createdAt),
      debit: 0,
      credit: Number(r.amount) || 0,
      voucherNo: r.receiptNumber,
      type: "Vendor Cash Receipt",
      description: r.narration || r.remarks || "Receipt from Vendor"
    });
  });

  pBankReceipts.forEach((r: any) => {
    txs.push({
      date: new Date(r.date || r.createdAt),
      debit: 0,
      credit: Number(r.amount) || 0,
      voucherNo: r.receiptNumber || r.instrumentNo,
      type: "Vendor Bank Receipt",
      description: r.narration || r.remarks || "Bank Receipt from Vendor"
    });
  });

  // Sort chronologically
  txs.sort((a, b) => a.date.getTime() - b.date.getTime());

  let totalDebit = 0;
  let totalCredit = 0;
  let running = initialOpening;

  txs.forEach(t => {
    running += t.credit - t.debit;
    t.runningBalance = running;
    if (t.date.getTime() <= toDateTime) {
      totalDebit += t.debit;
      totalCredit += t.credit;
    }
  });

  const closingBalance = initialOpening + totalCredit - totalDebit;

  return {
    opening: initialOpening,
    totalDebit,
    totalCredit,
    closing: closingBalance,
    txs
  };
}

/**
 * Calculate live Customer Net Balance (Debits = Sales/Payments, Credits = Receipts/Returns)
 * Natural Balance: Debit (positive = Customer owes Dokan)
 */
export function calculateCustomerBalance(
  customer: any,
  invoices: any[],
  cashReceipts: any[],
  bankReceipts: any[],
  cashPayments: any[] = [],
  bankPayments: any[] = [],
  toDate?: string | Date
) {
  const partyId = String(customer._id || customer.id || "");
  const customerName = String(customer.companyName || customer.name || "");
  const initialOpening = Number(customer.openingBalance) || 0;

  const isWalkIn = customerName.toLowerCase().includes("walk-in");
  const toDateTime = toDate ? new Date(toDate).getTime() : Infinity;

  const pInvoices = invoices.filter((inv: any) => 
    matchesEntity(inv.partyId || inv.customerId || inv.party, partyId, customerName)
  );
  const pCashReceipts = cashReceipts.filter((r: any) => 
    matchesEntity(r.partyId || r.party || r.customerId, partyId, customerName) && r.status !== "Cancelled"
  );
  const pBankReceipts = bankReceipts.filter((r: any) => 
    matchesEntity(r.partyId || r.party || r.customerId, partyId, customerName) && r.status !== "Cancelled"
  );
  const pCashPayments = cashPayments.filter((py: any) => 
    matchesEntity(py.partyId || py.customer || py.customerId, partyId, customerName) && py.status !== "Cancelled"
  );
  const pBankPayments = bankPayments.filter((py: any) => 
    matchesEntity(py.partyId || py.customer || py.customerId, partyId, customerName) && py.status !== "Cancelled"
  );

  const txs: PartyTransaction[] = [];

  pInvoices.forEach((s: any) => {
    if (s.status === "cancelled" || s.status === "Cancelled") return;
    const isReturn = s.type === "sale_return" || s.type === "non_tax_sale_return";
    if (["sale", "non_tax_sale", "challan", "pos", "sale_return", "non_tax_sale_return"].includes(s.type)) {
      const totalAmt = Number(s.totalAmount) || 0;
      let paidAtCreation = 0;
      if (!isReturn) {
        const invNo = s.invoiceNo || "";
        const linkedCashAmt = invNo ? pCashReceipts
          .filter((r: any) => r.reference === invNo || r.invoiceId === s._id || (r.narration && String(r.narration).toLowerCase().includes(invNo.toLowerCase())))
          .reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0) : 0;
        const linkedBankAmt = invNo ? pBankReceipts
          .filter((r: any) => r.instrumentNo === invNo || r.invoiceId === s._id || (r.narration && String(r.narration).toLowerCase().includes(invNo.toLowerCase())))
          .reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0) : 0;

        const isCredit = (s.paymentMethod || "").toLowerCase() === "credit" || s.isCreditBill;
        let rawPaid = 0;
        if (isCredit) {
          rawPaid = Number(s.amountReceived) || Number(s.amountPaid) || 0;
        } else {
          const isExplicitPaid = (s.paymentMethod || "").toLowerCase() === "cash" || (s.paymentMethod || "").toLowerCase() === "bank" || s.status === "paid" || s.balance === 0;
          rawPaid = isExplicitPaid ? totalAmt : (Number(s.amountReceived) || Number(s.amountPaid) || 0);
        }

        paidAtCreation = Math.max(0, rawPaid - (linkedCashAmt + linkedBankAmt));
      }

      txs.push({
        date: new Date(s.date || s.createdAt),
        debit: isReturn ? 0 : totalAmt,
        credit: isReturn ? totalAmt : paidAtCreation,
        voucherNo: s.invoiceNo,
        type: isReturn ? "Sale Return" : "Sale Invoice",
        description: s.notes || s.remarks || (isReturn ? "Sale Return" : "Sale Invoice")
      });
    }
  });

  pCashReceipts.forEach((r: any) => {
    txs.push({
      date: new Date(r.date || r.createdAt),
      debit: 0,
      credit: Number(r.amount) || 0,
      voucherNo: r.receiptNumber,
      type: "Cash Receipt",
      description: r.narration || r.remarks || "Cash Collection"
    });
  });

  pBankReceipts.forEach((r: any) => {
    txs.push({
      date: new Date(r.date || r.createdAt),
      debit: 0,
      credit: Number(r.amount) || 0,
      voucherNo: r.receiptNumber || r.instrumentNo,
      type: "Bank Receipt",
      description: r.narration || r.remarks || "Bank Collection"
    });
  });

  pCashPayments.forEach((py: any) => {
    txs.push({
      date: new Date(py.date || py.createdAt),
      debit: Number(py.amount) || 0,
      credit: 0,
      voucherNo: py.voucherNo,
      type: "Customer Cash Payment",
      description: py.narration || py.remarks || "Refund/Payment to Customer"
    });
  });

  pBankPayments.forEach((py: any) => {
    txs.push({
      date: new Date(py.date || py.createdAt),
      debit: Number(py.amount) || 0,
      credit: 0,
      voucherNo: py.voucherNo || py.chequeNo,
      type: "Customer Bank Payment",
      description: py.narration || py.remarks || "Bank Refund to Customer"
    });
  });

  // Sort chronologically
  txs.sort((a, b) => a.date.getTime() - b.date.getTime());

  let totalDebit = 0;
  let totalCredit = 0;
  let running = isWalkIn ? 0 : initialOpening;

  txs.forEach(t => {
    running += t.debit - t.credit;
    t.runningBalance = running;
    if (t.date.getTime() <= toDateTime) {
      totalDebit += t.debit;
      totalCredit += t.credit;
    }
  });

  const closingBalance = isWalkIn ? 0 : (initialOpening + totalDebit - totalCredit);

  return {
    opening: isWalkIn ? 0 : initialOpening,
    totalDebit,
    totalCredit,
    closing: closingBalance,
    txs
  };
}

/**
 * Calculate live Item Stock Quantity & Valuation
 */
export function calculateItemStock(item: any, invoices: any[] = [], adjustments: any[] = []) {
  const itemId = String(item._id || item.id || "");
  const initialOpening = Number(item.openingStock) || Number(item.openingBalance) || 0;
  const conv = Number(item.conversionFactor) || 1;
  const rate = Number(item.purchaseRate) || Number(item.costPrice) || Number(item.retailPrice) || 0;

  let purchases = 0;
  let sales = 0;
  let saleReturns = 0;
  let purchaseReturns = 0;
  let adjPlus = 0;
  let adjMinus = 0;

  invoices.forEach((inv: any) => {
    if (inv.status === "cancelled" || inv.status === "Cancelled") return;
    const lines = inv.lines || inv.items || [];
    lines.forEach((line: any) => {
      const lineItemId = String(line.itemId?._id || line.itemId || "");
      if (lineItemId === itemId || line.description === item.name || line.name === item.name) {
        const qty = Number(line.cartons ?? line.qty ?? line.quantity ?? 0);
        if (["purchase", "non_tax_purchase", "import_purchase"].includes(inv.type)) {
          purchases += qty;
        } else if (["sale", "non_tax_sale", "pos", "challan"].includes(inv.type)) {
          sales += qty;
        } else if (["sale_return", "non_tax_sale_return"].includes(inv.type)) {
          saleReturns += qty;
        } else if (["purchase_return", "non_tax_purchase_return"].includes(inv.type)) {
          purchaseReturns += qty;
        }
      }
    });
  });

  adjustments.forEach((adj: any) => {
    if (String(adj.itemId) === itemId) {
      const diff = Number(adj.quantityCartons || adj.qty || 0);
      if (diff > 0) adjPlus += diff;
      else adjMinus += Math.abs(diff);
    }
  });

  const currentCartons = initialOpening + purchases + saleReturns + adjPlus - sales - purchaseReturns - adjMinus;
  const currentLiters = currentCartons * conv;
  const valuation = currentCartons * rate;

  return {
    initialOpening,
    purchases,
    sales,
    saleReturns,
    purchaseReturns,
    currentCartons,
    currentLiters,
    valuation,
    reorderLevel: Number(item.reorderLevel) || 0,
    isLowStock: currentCartons <= (Number(item.reorderLevel) || 0)
  };
}

/**
 * Calculate Cash & Bank Position across all time or for a date period
 */
export function calculateCashBankPosition(
  opening: number,
  allInvoices: any[],
  cashReceipts: any[],
  bankReceipts: any[],
  cashPayments: any[],
  bankPayments: any[],
  otherIncomes: any[] = []
) {
  let receiptsFromSales = 0;
  allInvoices.forEach((i: any) => {
    if (["sale", "non_tax_sale", "pos", "challan"].includes(i.type) && i.status !== "cancelled" && i.status !== "Cancelled") {
      const total = Number(i.totalAmount) || 0;
      const isCredit = (i.paymentMethod || "").toLowerCase() === "credit" || i.isCreditBill;
      const amtRecv = Number(i.amountReceived) || 0;
      if (isCredit) {
        receiptsFromSales += Math.min(total, amtRecv);
      } else {
        const isPaid = (i.paymentMethod || "").toLowerCase() === "cash" || (i.paymentMethod || "").toLowerCase() === "bank" || i.status === "paid" || i.balance === 0;
        receiptsFromSales += isPaid ? total : Math.min(total, Math.max(amtRecv, Number(i.amountPaid) || 0));
      }
    }
  });

  const crSum = cashReceipts.filter(r => r.status !== "Cancelled").reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const brSum = bankReceipts.filter(r => r.status !== "Cancelled").reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const incSum = otherIncomes.reduce((s, inc) => s + (Number(inc.amount) || 0), 0);

  let paymentsForPurchases = 0;
  allInvoices.forEach((i: any) => {
    if (["purchase", "non_tax_purchase", "import_purchase"].includes(i.type) && i.status !== "cancelled" && i.status !== "Cancelled") {
      const total = Number(i.totalAmount) || 0;
      const isCredit = (i.paymentMethod || "").toLowerCase() === "credit" || i.isCreditBill;
      const amtPaid = Number(i.amountPaid) || Number(i.amountReceived) || 0;
      if (isCredit) {
        paymentsForPurchases += Math.min(total, amtPaid);
      } else {
        paymentsForPurchases += total;
      }
    }
  });

  const cpSum = cashPayments.filter(p => p.status !== "Cancelled").reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const bpSum = bankPayments.filter(p => p.status !== "Cancelled").reduce((s, p) => s + (Number(p.amount) || 0), 0);

  const totalInflow = receiptsFromSales + crSum + brSum + incSum;
  const totalOutflow = paymentsForPurchases + cpSum + bpSum;
  const current = opening + totalInflow - totalOutflow;

  return {
    opening,
    receiptsFromSales,
    cashReceipts: crSum,
    bankReceipts: brSum,
    otherIncome: incSum,
    totalInflow,
    paymentsForPurchases,
    cashPayments: cpSum,
    bankPayments: bpSum,
    totalOutflow,
    current
  };
}

/**
 * Calculate Vehicle Trip Profitability
 */
export function calculateVehicleTripProfit(vehicle: any, invoices: any[], expenses: any[]) {
  const regNo = String(vehicle.regNo || vehicle.vehicleNo || "").toUpperCase();
  
  const tripInvoices = invoices.filter((i: any) => 
    String(i.regNo || i.vehicleNo || "").toUpperCase() === regNo && i.status !== "cancelled" && i.status !== "Cancelled"
  );
  const tripExpenses = expenses.filter((e: any) => 
    String(e.regNo || e.vehicleNo || "").toUpperCase() === regNo && e.status !== "Cancelled"
  );

  const totalRevenue = tripInvoices.reduce((s, i) => s + (Number(i.totalAmount) || 0), 0);
  const totalDiscounts = tripInvoices.reduce((s, i) => s + (Number(i.discountAmount) || 0), 0);
  const totalExpenses = tripExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const netProfit = totalRevenue - totalDiscounts - totalExpenses;

  return {
    regNo,
    tripsCount: tripInvoices.length,
    totalRevenue,
    totalDiscounts,
    totalExpenses,
    netProfit
  };
}


export interface CashBankTransaction {
  date: Date;
  voucherNo: string;
  voucherType: string;
  module: string;
  accountTitle: string;
  accountCode: string;
  remarks: string;
  debit: number;
  credit: number;
  runningBalance: number;
  source: string;
}

export function calculateCashBankLedger(
  initialOpening: number,
  allInvoices: any[],
  cashReceipts: any[],
  bankReceipts: any[],
  cashPayments: any[],
  bankPayments: any[],
  otherIncomes: any[] = [],
  expenses: any[] = []
): { txs: CashBankTransaction[], closing: number } {
  const txs: CashBankTransaction[] = [];
  
  // 1. Invoices
  allInvoices.forEach(i => {
    if (i.status === "cancelled" || i.status === "Cancelled") return;
    const isSale = ["sale", "non_tax_sale", "pos", "challan"].includes(i.type);
    const isPurchase = ["purchase", "non_tax_purchase", "import_purchase"].includes(i.type);
    const isSaleReturn = ["sale_return", "non_tax_sale_return"].includes(i.type);
    const isPurchaseReturn = ["purchase_return", "non_tax_purchase_return"].includes(i.type);
    
    const total = Number(i.totalAmount) || 0;
    const isCredit = (i.paymentMethod || "").toLowerCase() === "credit" || i.isCreditBill;
    
    if (isSale) {
      const amtRecv = Number(i.amountReceived) || 0;
      let paid = 0;
      if (isCredit) {
        paid = Math.min(total, amtRecv);
      } else {
        const isPaidFull = (i.paymentMethod || "").toLowerCase() === "cash" || (i.paymentMethod || "").toLowerCase() === "bank" || i.status === "paid" || i.balance === 0;
        paid = isPaidFull ? total : Math.min(total, Math.max(amtRecv, Number(i.amountPaid) || 0));
      }
      if (paid > 0) {
        txs.push({
          date: new Date(i.date || i.createdAt),
          voucherNo: i.invoiceNo || "INV",
          voucherType: i.type,
          module: "Sales",
          accountTitle: "Sales Collection",
          accountCode: "1111",
          remarks: `Collection for ${i.invoiceNo || "Sale"} - ${i.customerName || "Customer"}`,
          debit: paid,
          credit: 0,
          runningBalance: 0,
          source: "invoices"
        });
      }
    } else if (isPurchase) {
      const amtPaid = Number(i.amountPaid) || Number(i.amountReceived) || 0;
      let paid = isCredit ? Math.min(total, amtPaid) : total;
      if (paid > 0) {
        txs.push({
          date: new Date(i.date || i.createdAt),
          voucherNo: i.invoiceNo || "PUR",
          voucherType: i.type,
          module: "Purchases",
          accountTitle: "Purchase Payment",
          accountCode: "1111",
          remarks: `Payment for ${i.invoiceNo || "Purchase"} - ${i.vendorName || "Vendor"}`,
          debit: 0,
          credit: paid,
          runningBalance: 0,
          source: "invoices"
        });
      }
    } else if (isSaleReturn) {
      const amtPaid = Number(i.amountPaid) || Number(i.amountReceived) || 0;
      if (amtPaid > 0) {
        txs.push({
          date: new Date(i.date || i.createdAt),
          voucherNo: i.invoiceNo || "SR",
          voucherType: i.type,
          module: "Sales Return",
          accountTitle: "Sales Return Refund",
          accountCode: "1111",
          remarks: `Refund for ${i.invoiceNo || "Return"} - ${i.customerName || "Customer"}`,
          debit: 0,
          credit: amtPaid,
          runningBalance: 0,
          source: "invoices"
        });
      }
    } else if (isPurchaseReturn) {
      const amtRecv = Number(i.amountReceived) || 0;
      if (amtRecv > 0) {
        txs.push({
          date: new Date(i.date || i.createdAt),
          voucherNo: i.invoiceNo || "PR",
          voucherType: i.type,
          module: "Purchase Return",
          accountTitle: "Purchase Return Refund",
          accountCode: "1111",
          remarks: `Refund from ${i.invoiceNo || "Return"} - ${i.vendorName || "Vendor"}`,
          debit: amtRecv,
          credit: 0,
          runningBalance: 0,
          source: "invoices"
        });
      }
    }
  });

  // 2. Cash Receipts
  cashReceipts.forEach(r => {
    if (r.status === "Cancelled") return;
    txs.push({
      date: new Date(r.date || r.createdAt),
      voucherNo: r.receiptNumber || r.voucherNo || "CRV",
      voucherType: "CRV",
      module: "Cash Receipts",
      accountTitle: r.partyName || r.customerName || "Cash Receipt",
      accountCode: "1111",
      remarks: r.narration || r.remarks || "Cash Receipt",
      debit: Number(r.amount) || 0,
      credit: 0,
      runningBalance: 0,
      source: "cash_receipts"
    });
  });

  // 3. Bank Receipts
  bankReceipts.forEach(r => {
    if (r.status === "Cancelled") return;
    txs.push({
      date: new Date(r.date || r.createdAt),
      voucherNo: r.receiptNumber || r.instrumentNo || "BRV",
      voucherType: "BRV",
      module: "Bank Receipts",
      accountTitle: r.partyName || r.customerName || r.bankName || "Bank Receipt",
      accountCode: "1110",
      remarks: r.narration || r.remarks || "Bank Receipt",
      debit: Number(r.amount) || 0,
      credit: 0,
      runningBalance: 0,
      source: "bank_receipts"
    });
  });

  // 4. Cash Payments
  cashPayments.forEach(p => {
    if (p.status === "Cancelled") return;
    txs.push({
      date: new Date(p.date || p.createdAt),
      voucherNo: p.paymentNumber || p.voucherNo || "CPV",
      voucherType: "CPV",
      module: "Cash Payments",
      accountTitle: p.partyName || p.vendorName || "Cash Payment",
      accountCode: "1111",
      remarks: p.narration || p.remarks || "Cash Payment",
      debit: 0,
      credit: Number(p.amount) || 0,
      runningBalance: 0,
      source: "cash_payments"
    });
  });

  // 5. Bank Payments
  bankPayments.forEach(p => {
    if (p.status === "Cancelled") return;
    txs.push({
      date: new Date(p.date || p.createdAt),
      voucherNo: p.paymentNumber || p.instrumentNo || "BPV",
      voucherType: "BPV",
      module: "Bank Payments",
      accountTitle: p.partyName || p.vendorName || p.bankName || "Bank Payment",
      accountCode: "1110",
      remarks: p.narration || p.remarks || "Bank Payment",
      debit: 0,
      credit: Number(p.amount) || 0,
      runningBalance: 0,
      source: "bank_payments"
    });
  });

  // 6. Other Incomes
  otherIncomes.forEach(inc => {
    txs.push({
      date: new Date(inc.date || inc.createdAt),
      voucherNo: inc.receiptNo || "OIV",
      voucherType: "OIV",
      module: "Other Income",
      accountTitle: inc.incomeCategory || "Income",
      accountCode: "1111",
      remarks: inc.narration || inc.remarks || "Other Income",
      debit: Number(inc.amount) || 0,
      credit: 0,
      runningBalance: 0,
      source: "incomes"
    });
  });

  // 7. Expenses
  expenses.forEach(e => {
    txs.push({
      date: new Date(e.date || e.createdAt),
      voucherNo: e.voucherNo || "EXP",
      voucherType: "EXP",
      module: "Expenses",
      accountTitle: e.expenseCategory || e.category || "Expense",
      accountCode: "1111",
      remarks: e.narration || e.remarks || "Expense",
      debit: 0,
      credit: Number(e.amount) || 0,
      runningBalance: 0,
      source: "expenses"
    });
  });

  txs.sort((a, b) => a.date.getTime() - b.date.getTime());

  let running = initialOpening;
  txs.forEach(t => {
    running += (t.debit - t.credit);
    t.runningBalance = running;
  });

  return { txs, closing: running };
}
