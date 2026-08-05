/**
 * Centralized Party (Vendor & Customer) Live Balance Service
 * Single Source of Truth for all Vendor and Customer Balances across the ERP.
 */

export interface PartyTransaction {
  date: Date;
  debit: number;
  credit: number;
  description?: string;
  voucherNo?: string;
  type?: string;
}

export function calculateVendorBalance(
  vendor: any,
  invoices: any[],
  cashPayments: any[],
  bankPayments: any[],
  cashReceipts: any[] = [],
  bankReceipts: any[] = [],
  toDate?: string | Date
) {
  const partyId = String(vendor._id || vendor.id);
  const initialOpening = Number(vendor.openingBalance) || 0;

  const toDateTime = toDate ? new Date(toDate).getTime() : Infinity;

  const pInvoices = invoices.filter((inv: any) => 
    String(inv.partyId?._id || inv.partyId) === partyId || inv.vendor === vendor.name
  );
  const pCashPayments = cashPayments.filter((py: any) => 
    String(py.partyId?._id || py.partyId || py.vendor) === partyId || py.vendor === vendor.name
  );
  const pBankPayments = bankPayments.filter((py: any) => 
    String(py.partyId?._id || py.partyId || py.vendor) === partyId || py.vendor === vendor.name
  );
  const pCashReceipts = cashReceipts.filter((r: any) => 
    String(r.partyId?._id || r.partyId || r.party) === partyId || r.party === vendor.name
  );
  const pBankReceipts = bankReceipts.filter((r: any) => 
    String(r.partyId?._id || r.partyId || r.party) === partyId || r.party === vendor.name
  );

  const txs: PartyTransaction[] = [];

  pInvoices.forEach((s: any) => {
    const isReturn = s.type === "purchase_return" || s.type === "non_tax_purchase_return";
    if (["purchase", "non_tax_purchase", "import_purchase", "purchase_return", "non_tax_purchase_return"].includes(s.type)) {
      const totalAmt = Number(s.totalAmount) || 0;
      let paidAtCreation = 0;
      if (!isReturn) {
        const invNo = s.invoiceNo || "";
        const linkedCashAmt = invNo ? pCashPayments
          .filter((py: any) => py.reference === invNo || (py.narration && py.narration.toLowerCase().includes(invNo.toLowerCase())))
          .reduce((sum: number, py: any) => sum + (Number(py.amount) || 0), 0) : 0;
        const linkedBankAmt = invNo ? pBankPayments
          .filter((py: any) => py.instrumentNo === invNo || (py.instrumentNo && py.instrumentNo.toLowerCase().includes(invNo.toLowerCase())))
          .reduce((sum: number, py: any) => sum + (Number(py.amount) || 0), 0) : 0;

        const rawPaid = (Number(s.amountReceived) > 0 ? Number(s.amountReceived) : 0) ||
                        (Number(s.amountPaid) > 0 ? Number(s.amountPaid) : 0) ||
                        ((s.paymentMethod === "Cash" || s.paymentMethod === "Bank" || s.status === "paid" || s.balance === 0) ? totalAmt : 0);

        paidAtCreation = Math.max(0, rawPaid - (linkedCashAmt + linkedBankAmt));
      }
      txs.push({
        date: new Date(s.date || s.createdAt),
        debit: isReturn ? totalAmt : paidAtCreation,
        credit: isReturn ? 0 : totalAmt,
        voucherNo: s.invoiceNo,
        type: isReturn ? "Purchase Return" : "Purchase Invoice"
      });
    }
  });

  pCashPayments.forEach((py: any) => {
    txs.push({
      date: new Date(py.date || py.createdAt),
      debit: Number(py.amount) || 0,
      credit: 0,
      voucherNo: py.voucherNo,
      type: "Cash Payment"
    });
  });

  pBankPayments.forEach((py: any) => {
    txs.push({
      date: new Date(py.date || py.createdAt),
      debit: Number(py.amount) || 0,
      credit: 0,
      voucherNo: py.voucherNo || py.chequeNo,
      type: "Bank Payment"
    });
  });

  pCashReceipts.forEach((r: any) => {
    txs.push({
      date: new Date(r.date || r.createdAt),
      debit: 0,
      credit: Number(r.amount) || 0,
      voucherNo: r.receiptNumber,
      type: "Vendor Cash Receipt"
    });
  });

  pBankReceipts.forEach((r: any) => {
    txs.push({
      date: new Date(r.date || r.createdAt),
      debit: 0,
      credit: Number(r.amount) || 0,
      voucherNo: r.receiptNumber || r.instrumentNo,
      type: "Vendor Bank Receipt"
    });
  });

  let totalDebit = 0;
  let totalCredit = 0;

  txs.forEach(t => {
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

export function calculateCustomerBalance(
  customer: any,
  invoices: any[],
  cashReceipts: any[],
  bankReceipts: any[],
  cashPayments: any[] = [],
  bankPayments: any[] = [],
  toDate?: string | Date
) {
  const partyId = String(customer._id || customer.id);
  const initialOpening = Math.abs(Number(customer.openingBalance) || 0);

  const toDateTime = toDate ? new Date(toDate).getTime() : Infinity;

  const pInvoices = invoices.filter((inv: any) => String(inv.partyId?._id || inv.partyId) === partyId);
  const pCashReceipts = cashReceipts.filter((r: any) => String(r.partyId?._id || r.partyId || r.party) === partyId);
  const pBankReceipts = bankReceipts.filter((r: any) => String(r.partyId?._id || r.partyId || r.party) === partyId);
  const pCashPayments = cashPayments.filter((py: any) => String(py.partyId?._id || py.partyId || py.customer) === partyId);
  const pBankPayments = bankPayments.filter((py: any) => String(py.customer || py.partyId) === partyId);

  const txs: PartyTransaction[] = [];

  pInvoices.forEach((s: any) => {
    const isReturn = s.type === "sale_return" || s.type === "non_tax_sale_return";
    if (["sale", "non_tax_sale", "challan", "pos", "sale_return", "non_tax_sale_return"].includes(s.type)) {
      const totalAmt = Number(s.totalAmount) || 0;
      let paidAtCreation = 0;
      if (!isReturn) {
        const invNo = s.invoiceNo || "";
        const linkedCashAmt = invNo ? pCashReceipts
          .filter((r: any) => r.reference === invNo || (r.remarks && r.remarks.toLowerCase().includes(invNo.toLowerCase())))
          .reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0) : 0;
        const linkedBankAmt = invNo ? pBankReceipts
          .filter((r: any) => r.instrumentNo === invNo || (r.instrumentNo && r.instrumentNo.toLowerCase().includes(invNo.toLowerCase())))
          .reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0) : 0;

        const rawPaid = (Number(s.amountReceived) > 0 ? Number(s.amountReceived) : 0) ||
                        (Number(s.amountPaid) > 0 ? Number(s.amountPaid) : 0) ||
                        ((s.paymentMethod === "Cash" || s.paymentMethod === "Bank" || s.status === "paid" || s.balance === 0) ? totalAmt : 0);

        paidAtCreation = Math.max(0, rawPaid - (linkedCashAmt + linkedBankAmt));
      }

      txs.push({
        date: new Date(s.date || s.createdAt),
        debit: isReturn ? 0 : totalAmt,
        credit: isReturn ? totalAmt : paidAtCreation,
        voucherNo: s.invoiceNo,
        type: isReturn ? "Sale Return" : "Sale Invoice"
      });
    }
  });

  pCashReceipts.forEach((r: any) => txs.push({ date: new Date(r.date || r.createdAt), debit: 0, credit: Number(r.amount) || 0, voucherNo: r.receiptNumber, type: "Cash Receipt" }));
  pBankReceipts.forEach((r: any) => txs.push({ date: new Date(r.date || r.createdAt), debit: 0, credit: Number(r.amount) || 0, voucherNo: r.receiptNumber, type: "Bank Receipt" }));
  pCashPayments.forEach((py: any) => txs.push({ date: new Date(py.date || py.createdAt), debit: Number(py.amount) || 0, credit: 0, voucherNo: py.voucherNo, type: "Customer Cash Payment" }));
  pBankPayments.forEach((py: any) => txs.push({ date: new Date(py.date || py.createdAt), debit: Number(py.amount) || 0, credit: 0, voucherNo: py.voucherNo, type: "Customer Bank Payment" }));

  let totalDebit = 0;
  let totalCredit = 0;

  txs.forEach(t => {
    if (t.date.getTime() <= toDateTime) {
      totalDebit += t.debit;
      totalCredit += t.credit;
    }
  });

  const closingBalance = initialOpening + totalDebit - totalCredit;

  return {
    opening: initialOpening,
    totalDebit,
    totalCredit,
    closing: closingBalance,
    txs
  };
}
