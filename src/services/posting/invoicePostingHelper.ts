import { 
  getDocuments, 
  getDocumentById, 
  createDocument, 
  updateDocument, 
  deleteDocument,
  query,
  where,
  collection,
  db,
  getDocs,
  writeBatch,
  doc
} from "@/lib/firestore/genericRepository";
import { calculateCustomerBalance, calculateVendorBalance } from "@/lib/centralizedBalanceService";

async function getOrCreateTaxAccount() {
  const accounts = await getDocuments("accounts");
  let acc = accounts.find((a: any) => 
    a.code === "Tax on Purchased Items" || 
    a.code === "Tax on Purchased items" || 
    String(a.title || "").toLowerCase() === "tax on purchased items"
  );
  if (!acc) {
    acc = await createDocument("accounts", {
      code: "Tax on Purchased Items",
      title: "Tax on Purchased Items",
      type: "expense",
      openingBalance: 0
    });
  }
  return acc;
}

export async function recalculatePartyBalance(partyIdOrObj: any) {
  try {
    if (!partyIdOrObj) return;

    const partyId = typeof partyIdOrObj === "object" && partyIdOrObj !== null
      ? String(partyIdOrObj._id || partyIdOrObj.id || "")
      : String(partyIdOrObj);

    if (!partyId || partyId === "[object Object]") return;

    const party = await getDocumentById("parties", partyId);
    if (!party) return;

    // Walk-in Customer Fix: always force balance, debit, and credit to 0
    if ((party.name || party.companyName || "").toLowerCase().includes("walk-in")) {
      await updateDocument("parties", partyId, { debit: 0, credit: 0, balance: 0 });
      return;
    }

    const [allInvoices, allCashReceipts, allBankReceipts, allCashPayments, allBankPayments] = await Promise.all([
      getDocuments("invoices"),
      getDocuments("cash_receipts"),
      getDocuments("bank_receipts"),
      getDocuments("cash_payments"),
      getDocuments("bank_payments")
    ]);

    const isCustomer = party.type === "Customer";
    if (isCustomer) {
      const result = calculateCustomerBalance(party, allInvoices, allCashReceipts, allBankReceipts, allCashPayments, allBankPayments);
      const debit = (Number(party.manualDebit) || 0) + (Number(result.totalDebit) || 0);
      const credit = (Number(party.manualCredit) || 0) + (Number(result.totalCredit) || 0);
      const balance = (Number(party.openingBalance) || 0) + debit - credit;
      await updateDocument("parties", partyId, { debit, credit, balance });
    } else {
      const result = calculateVendorBalance(party, allInvoices, allCashPayments, allBankPayments, allCashReceipts, allBankReceipts);
      const credit = (Number(party.manualCredit) || 0) + (Number(result.totalCredit) || 0);
      const debit = (Number(party.manualDebit) || 0) + (Number(result.totalDebit) || 0);
      const balance = (Number(party.openingBalance) || 0) + credit - debit;
      await updateDocument("parties", partyId, { debit, credit, balance });
    }
  } catch (err) {
    console.warn("recalculatePartyBalance error:", err);
  }
}

export async function deleteJournalEntriesByInvoiceId(invoiceId: string) {
  try {
    const entries = await getDocuments("journal_entries");
    const toDelete = entries.filter((e: any) => String(e.invoiceId) === String(invoiceId));
    for (const item of toDelete) {
      if (item._id || item.id) {
        await deleteDocument("journal_entries", item._id || item.id);
      }
    }
  } catch (err) {
    console.warn("deleteJournalEntriesByInvoiceId error:", err);
  }
}

export async function deleteJournalEntriesByVoucherNo(voucherNo: string) {
  const entries = await getDocuments("journal_entries");
  const toDelete = entries.filter((e: any) => String(e.voucherNo) === String(voucherNo));
  for (const item of toDelete) {
    await deleteDocument("journal_entries", item._id);
  }
}

export async function generateInvoiceJournalEntries(invoice: any) {
  try {
    await deleteJournalEntriesByInvoiceId(String(invoice._id || invoice.id));

  const total = Number(invoice.totalAmount) || 0;
  if (total <= 0) {
    if (invoice.partyId) {
      await recalculatePartyBalance(String(invoice.partyId));
    }
    return;
  }

  const invoiceIdStr = String(invoice._id || invoice.id);
  const voucherNo = invoice.invoiceNo || `INV-${invoiceIdStr}`;
  const date = invoice.date || invoice.createdAt || new Date().toISOString();
  const paymentMethod = invoice.paymentMethod || invoice.paymentTerms || "Credit";

  let isWalkIn = false;
  if (invoice.partyId) {
    const party = await getDocumentById("parties", String(invoice.partyId));
    if (party && (party.name || party.companyName || "").toLowerCase().includes("walk-in")) {
      isWalkIn = true;
    }
  }

  const isCash = paymentMethod === "Cash" || paymentMethod === "Card" || isWalkIn;
  const isBank = paymentMethod === "Bank" || paymentMethod === "Online";

  const assetCode = (isCash || isWalkIn) ? (isBank ? "1110" : "1111") : "1100";
  const assetTitle = (isCash || isWalkIn) ? (isBank ? "Bank" : "Cash") : "Accounts Receivable";

  const liabilityCode = isCash ? "1111" : isBank ? "1110" : "2100";
  const liabilityTitle = isCash ? "Cash" : isBank ? "Bank" : "Accounts Payable";

  if (invoice.type === "sale" || invoice.type === "pos" || invoice.type === "non_tax_sale") {
    const entries = [
      {
        invoiceId: invoiceIdStr,
        voucherNo,
        date,
        accountCode: assetCode,
        accountTitle: assetTitle,
        debit: total,
        credit: 0,
        remarks: `${invoice.type === "non_tax_sale" ? "Non-Tax " : ""}Sales invoice posted (${paymentMethod})`,
        partyId: invoice.partyId || null
      },
      {
        invoiceId: invoiceIdStr,
        voucherNo,
        date,
        accountCode: "4100",
        accountTitle: "Sales",
        debit: 0,
        credit: total,
        remarks: `${invoice.type === "non_tax_sale" ? "Non-Tax " : ""}Sales invoice posted (${paymentMethod})`,
        partyId: invoice.partyId || null
      }
    ];

    if (assetCode === "1100" && invoice.amountReceived > 0) {
      const recvMethod = invoice.paymentMethod === "Bank" ? "1110" : "1111";
      const recvTitle = invoice.paymentMethod === "Bank" ? "Bank" : "Cash";
      entries.push({
        invoiceId: invoiceIdStr,
        voucherNo,
        date,
        accountCode: recvMethod,
        accountTitle: recvTitle,
        debit: invoice.amountReceived,
        credit: 0,
        remarks: `Down payment received at sale`,
        partyId: null
      });
      entries.push({
        invoiceId: invoiceIdStr,
        voucherNo,
        date,
        accountCode: "1100",
        accountTitle: "Accounts Receivable",
        debit: 0,
        credit: invoice.amountReceived,
        remarks: `Down payment received at sale`,
        partyId: invoice.partyId || null
      });
    }

    if (invoice.useAdvance && invoice.advanceAmountUsed > 0) {
      entries.push({
        invoiceId: invoiceIdStr,
        voucherNo,
        date,
        accountCode: "2120",
        accountTitle: "Customer Advance Liability",
        debit: invoice.advanceAmountUsed,
        credit: 0,
        remarks: `Customer advance used against invoice`,
        partyId: invoice.partyId || null
      });
      entries.push({
        invoiceId: invoiceIdStr,
        voucherNo,
        date,
        accountCode: "1100",
        accountTitle: "Accounts Receivable",
        debit: 0,
        credit: invoice.advanceAmountUsed,
        remarks: `Customer advance used against invoice`,
        partyId: invoice.partyId || null
      });
    }

    for (const entry of entries) {
      await createDocument("journal_entries", entry);
    }
  } else if (invoice.type === "sale_return" || invoice.type === "non_tax_sale_return") {
    const entries = [
      {
        invoiceId: invoiceIdStr,
        voucherNo,
        date,
        accountCode: "4101",
        accountTitle: "Sales Return",
        debit: total,
        credit: 0,
        remarks: `${invoice.type === "non_tax_sale_return" ? "Non-Tax " : ""}Sales return posted`,
        partyId: invoice.partyId || null
      },
      {
        invoiceId: invoiceIdStr,
        voucherNo,
        date,
        accountCode: assetCode,
        accountTitle: assetTitle,
        debit: 0,
        credit: total,
        remarks: `${invoice.type === "non_tax_sale_return" ? "Non-Tax " : ""}Sales return posted`,
        partyId: invoice.partyId || null
      }
    ];
    for (const entry of entries) {
      await createDocument("journal_entries", entry);
    }
  } else if (invoice.type === "purchase" || invoice.type === "non_tax_purchase" || invoice.type === "import_purchase") {
    const taxAmount = Number(invoice.taxAmount) || 0;
    const subTotal = Number(invoice.subTotal) || 0;
    const discountAmount = Number(invoice.discountAmount) || 0;
    const purchasesAmt = Math.max(0, subTotal - discountAmount);

    let expenseAmount = Number(invoice.expenseAmount) || 0;
    if (Array.isArray(invoice.expenses) && invoice.expenses.length > 0) {
      expenseAmount = invoice.expenses.reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
    }

    const paidAmt = (Number(invoice.amountReceived) > 0 ? Number(invoice.amountReceived) : 0) ||
                    (Number(invoice.amountPaid) > 0 ? Number(invoice.amountPaid) : 0) ||
                    (isCash || isBank || invoice.status === "paid" || invoice.balance === 0 ? total : 0);

    const paidPortion = Math.min(total, Math.max(0, paidAmt));
    const unpaidPortion = Math.max(0, total - paidPortion);

    const entries = [];

    entries.push({
      invoiceId: invoiceIdStr,
      voucherNo,
      date,
      accountCode: "5100",
      accountTitle: "Purchases",
      debit: purchasesAmt,
      credit: 0,
      remarks: `${invoice.type === "non_tax_purchase" ? "Non-Tax " : ""}Purchase invoice posted (${paymentMethod})`,
      partyId: invoice.partyId || null
    });

    if (Array.isArray(invoice.expenses) && invoice.expenses.length > 0) {
      for (const exp of invoice.expenses) {
        if (Number(exp.amount) > 0) {
          entries.push({
            invoiceId: invoiceIdStr,
            voucherNo,
            date,
            accountCode: exp.accountCode || "6100",
            accountTitle: exp.accountTitle || exp.description || "Purchase Expense",
            debit: Number(exp.amount),
            credit: 0,
            remarks: `Purchase Expense - ${exp.description || "Freight/Handling"}`,
            partyId: invoice.partyId || null
          });
        }
      }
    } else if (expenseAmount > 0) {
      entries.push({
        invoiceId: invoiceIdStr,
        voucherNo,
        date,
        accountCode: "6100",
        accountTitle: "Shop/Dokan Maintenance Expense",
        debit: expenseAmount,
        credit: 0,
        remarks: "Purchase Expense",
        partyId: invoice.partyId || null
      });
    }

    if (taxAmount > 0) {
      const taxAcc = await getOrCreateTaxAccount();
      let vendorName = "";
      if (invoice.partyId) {
        const party = await getDocumentById("parties", String(invoice.partyId));
        if (party) {
          vendorName = party.companyName || party.name || "";
        }
      }
      entries.push({
        invoiceId: invoiceIdStr,
        voucherNo,
        date,
        accountCode: taxAcc.code,
        accountTitle: taxAcc.title,
        debit: taxAmount,
        credit: 0,
        remarks: `Purchase Tax - ${vendorName}`.trim(),
        partyId: invoice.partyId || null
      });
    }

    if (paidPortion > 0) {
      const payMethod = (paymentMethod === "Bank" || invoice.paymentMethod === "Bank") ? "1110" : "1111";
      const payTitle = (paymentMethod === "Bank" || invoice.paymentMethod === "Bank") ? "Bank" : "Cash";
      entries.push({
        invoiceId: invoiceIdStr,
        voucherNo,
        date,
        accountCode: payMethod,
        accountTitle: payTitle,
        debit: 0,
        credit: paidPortion,
        remarks: `Payment made at purchase (${payTitle})`,
        partyId: null
      });
    }

    if (unpaidPortion > 0) {
      entries.push({
        invoiceId: invoiceIdStr,
        voucherNo,
        date,
        accountCode: "2100",
        accountTitle: "Accounts Payable",
        debit: 0,
        credit: unpaidPortion,
        remarks: `Purchase invoice posted (Credit)`,
        partyId: invoice.partyId || null
      });
    }

    for (const entry of entries) {
      await createDocument("journal_entries", entry);
    }
  } else if (invoice.type === "purchase_order" || invoice.type === "grn") {
    if (invoice.amountReceived > 0) {
      const payMethod = invoice.paymentMethod === "Bank" ? "1110" : "1111";
      const payTitle = invoice.paymentMethod === "Bank" ? "Bank" : "Cash";
      const entries = [
        {
          invoiceId: invoiceIdStr,
          voucherNo,
          date,
          accountCode: "2100",
          accountTitle: "Accounts Payable",
          debit: invoice.amountReceived,
          credit: 0,
          remarks: `Payment made at ${invoice.type === "grn" ? "GRN" : "PO"}`,
          partyId: invoice.partyId || null
        },
        {
          invoiceId: invoiceIdStr,
          voucherNo,
          date,
          accountCode: payMethod,
          accountTitle: payTitle,
          debit: 0,
          credit: invoice.amountReceived,
          remarks: `Payment made at ${invoice.type === "grn" ? "GRN" : "PO"}`,
          partyId: null
        }
      ];
      for (const entry of entries) {
        await createDocument("journal_entries", entry);
      }
    }
  } else if (invoice.type === "purchase_return" || invoice.type === "non_tax_purchase_return") {
    const entries = [
      {
        invoiceId: invoiceIdStr,
        voucherNo,
        date,
        accountCode: liabilityCode,
        accountTitle: liabilityTitle,
        debit: total,
        credit: 0,
        remarks: `${invoice.type === "non_tax_purchase_return" ? "Non-Tax " : ""}Purchase return posted`,
        partyId: invoice.partyId || null
      },
      {
        invoiceId: invoiceIdStr,
        voucherNo,
        date,
        accountCode: "5101",
        accountTitle: "Purchase Return",
        debit: 0,
        credit: total,
        remarks: `${invoice.type === "non_tax_purchase_return" ? "Non-Tax " : ""}Purchase return posted`,
        partyId: invoice.partyId || null
      }
    ];
    for (const entry of entries) {
      await createDocument("journal_entries", entry);
    }
  }

  if (invoice.partyId) {
    await recalculatePartyBalance(String(invoice.partyId));
  }
  } catch (err) {
    console.warn("generateInvoiceJournalEntries error:", err);
  }
}

export async function getCustomerAdvanceStats(customerId: string) {
  const entries = await getDocuments("journal_entries");
  const filtered2120 = entries.filter((e: any) => e.accountCode === "2120");
  
  const allCashReceipts = await getDocuments("cash_receipts");
  const customerReceipts = allCashReceipts.filter((r: any) => 
    String(r.partyId) === String(customerId) && 
    r.status !== "Cancelled" && 
    ["Advance", "Deposit", "Extra Cash"].includes(r.partyReceiptType)
  );
  const receiptVouchers = new Set(customerReceipts.map((r: any) => r.receiptNumber));
  
  let totalAdvance = 0;
  let totalUsed = 0;
  let totalRefunded = 0;

  for (const e of filtered2120) {
    if (receiptVouchers.has(e.voucherNo)) {
      totalAdvance += Number(e.credit) || 0;
    }
    if (Number(e.debit) > 0 && e.partyId && String(e.partyId) === String(customerId)) {
      totalRefunded += Number(e.debit);
    }
  }

  const allInvoices = await getDocuments("invoices");
  const customerInvoices = allInvoices.filter((inv: any) => 
    String(inv.partyId) === String(customerId) && 
    inv.useAdvance === true && 
    Number(inv.advanceAmountUsed) > 0
  );
  totalUsed = customerInvoices.reduce((sum: number, inv: any) => sum + (Number(inv.advanceAmountUsed) || 0), 0);
  
  const allCashPayments = await getDocuments("cash_payments");
  const allBankPayments = await getDocuments("bank_payments");
  const cashPaymentRefunds = allCashPayments.filter((p: any) => String(p.partyId) === String(customerId) && p.isRefund === true && p.status === "Posted");
  const bankPaymentRefunds = allBankPayments.filter((p: any) => String(p.vendor) === String(customerId) && p.isRefund === true && p.status === "Posted");
  
  totalRefunded = cashPaymentRefunds.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0) +
                  bankPaymentRefunds.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);

  const remainingAdvance = Math.max(0, totalAdvance - totalUsed - totalRefunded);

  return { totalAdvance, totalUsed, totalRefunded, remainingAdvance };
}

export async function postCashReceiptJournalEntries(receipt: any) {
  await deleteJournalEntriesByVoucherNo(receipt.receiptNumber);

  if (receipt.status !== "Posted") return;

  const entries = [];
  const date = receipt.date ? new Date(receipt.date).toISOString() : new Date().toISOString();
  
  let cashCode = "00786";
  let cashTitle = "Cash Hand";
  if (receipt.cashAccountId) {
    const acc = await getDocumentById("accounts", String(receipt.cashAccountId));
    if (acc) {
      cashCode = acc.code || cashCode;
      cashTitle = acc.title || cashTitle;
    }
  }

  const receiptType = receipt.receiptType || "party";
  const amount = Number(receipt.amount) || 0;
  const remarks = receipt.narration || receipt.notes || "Cash Receipt";

  if (receipt.partyId) {
    const party = await getDocumentById("parties", String(receipt.partyId));
    const isCustomer = party ? party.type === "Customer" : true;
    const isAdvance = ["Advance", "Deposit", "Extra Cash"].includes(receipt.partyReceiptType);
    
    let accountCode = isCustomer ? "1100" : "2100";
    let accountTitle = isCustomer ? "Accounts Receivable" : "Accounts Payable";
    
    if (isAdvance && isCustomer) {
      accountCode = "2120";
      accountTitle = "Customer Advance Liability";
    }
    const partyType = isCustomer ? "customer" : "vendor";

    entries.push({
      date,
      voucherNo: receipt.receiptNumber,
      accountCode: cashCode,
      accountTitle: cashTitle,
      debit: amount,
      credit: 0,
      remarks: isAdvance ? `Customer Advance/Deposit received` : remarks,
      partyId: null,
      partyType: ""
    });
    entries.push({
      date,
      voucherNo: receipt.receiptNumber,
      accountCode,
      accountTitle,
      debit: 0,
      credit: amount,
      remarks: isAdvance ? `Customer Advance/Deposit received` : remarks,
      partyId: receipt.partyId,
      partyType
    });
  } else if (receiptType === "petty" && Array.isArray(receipt.contraLines)) {
    entries.push({
      date,
      voucherNo: receipt.receiptNumber,
      accountCode: cashCode,
      accountTitle: cashTitle,
      debit: amount,
      credit: 0,
      remarks,
      partyId: null,
      partyType: ""
    });
    for (const line of receipt.contraLines) {
      let code = "40002001";
      let title = "Other Income";
      if (line.accountId) {
        const acc = await getDocumentById("accounts", String(line.accountId));
        if (acc) {
          code = acc.code || code;
          title = acc.title || title;
        }
      }
      entries.push({
        date,
        voucherNo: receipt.receiptNumber,
        accountCode: code,
        accountTitle: title,
        debit: 0,
        credit: Number(line.amount) || 0,
        remarks: line.description || remarks,
        partyId: null,
        partyType: ""
      });
    }
  } else if (receiptType === "multi" && Array.isArray(receipt.partyLines)) {
    entries.push({
      date,
      voucherNo: receipt.receiptNumber,
      accountCode: cashCode,
      accountTitle: cashTitle,
      debit: amount,
      credit: 0,
      remarks,
      partyId: null,
      partyType: ""
    });
    for (const line of receipt.partyLines) {
      const party = await getDocumentById("parties", String(line.partyId));
      const isCustomer = party ? party.type === "Customer" : true;
      const accountCode = isCustomer ? "1100" : "2100";
      const accountTitle = isCustomer ? "Accounts Receivable" : "Accounts Payable";
      const partyType = isCustomer ? "customer" : "vendor";

      entries.push({
        date,
        voucherNo: receipt.receiptNumber,
        accountCode,
        accountTitle,
        debit: 0,
        credit: Number(line.amount) || 0,
        remarks,
        partyId: line.partyId || null,
        partyType
      });
    }
  }

  for (const entry of entries) {
    await createDocument("journal_entries", entry);
  }
}

export async function postCashPaymentJournalEntries(payment: any) {
  await deleteJournalEntriesByVoucherNo(payment.voucherNo);

  if (payment.status !== "Posted") return;

  const entries = [];
  const date = payment.date ? new Date(payment.date).toISOString() : new Date().toISOString();

  let cashCode = "00786";
  let cashTitle = "Cash Hand";
  if (payment.cashAccountId) {
    const acc = await getDocumentById("accounts", String(payment.cashAccountId));
    if (acc) {
      cashCode = acc.code || cashCode;
      cashTitle = acc.title || cashTitle;
    }
  }

  const paymentType = payment.paymentType || "party";
  const amount = Number(payment.amount) || 0;
  const remarks = payment.narration || payment.notes || "Cash Payment";

  if (payment.partyId) {
    const party = await getDocumentById("parties", String(payment.partyId));
    const isCustomer = party ? party.type === "Customer" : false;
    const isAdvanceRefund = isCustomer && (payment.isRefund || payment.partyPaymentType === "Refund");
    
    let accountCode = isCustomer ? "1100" : "2100";
    let accountTitle = isCustomer ? "Accounts Receivable" : "Accounts Payable";
    
    if (isAdvanceRefund) {
      accountCode = "2120";
      accountTitle = "Customer Advance Liability";
    }
    const partyType = isCustomer ? "customer" : "vendor";

    entries.push({
      date,
      voucherNo: payment.voucherNo,
      accountCode,
      accountTitle,
      debit: amount,
      credit: 0,
      remarks: isAdvanceRefund ? `Customer Advance Refunded` : remarks,
      partyId: payment.partyId,
      partyType
    });
    entries.push({
      date,
      voucherNo: payment.voucherNo,
      accountCode: cashCode,
      accountTitle: cashTitle,
      debit: 0,
      credit: amount,
      remarks: isAdvanceRefund ? `Customer Advance Refunded` : remarks,
      partyId: null,
      partyType: ""
    });
  } else if (paymentType === "petty" && Array.isArray(payment.contraLines)) {
    entries.push({
      date,
      voucherNo: payment.voucherNo,
      accountCode: cashCode,
      accountTitle: cashTitle,
      debit: 0,
      credit: amount,
      remarks,
      partyId: null,
      partyType: ""
    });
    for (const line of payment.contraLines) {
      let code = "5100";
      let title = "Purchases";
      if (line.accountId) {
        const acc = await getDocumentById("accounts", String(line.accountId));
        if (acc) {
          code = acc.code || code;
          title = acc.title || title;
        }
      }
      entries.push({
        date,
        voucherNo: payment.voucherNo,
        accountCode: code,
        accountTitle: title,
        debit: Number(line.amount) || 0,
        credit: 0,
        remarks: line.description || remarks,
        partyId: null,
        partyType: ""
      });
    }
  }

  for (const entry of entries) {
    await createDocument("journal_entries", entry);
  }
}

export async function postBankReceiptJournalEntries(receipt: any) {
  const vNo = receipt.receiptNumber || receipt.voucherNo;
  await deleteJournalEntriesByVoucherNo(vNo);

  if (receipt.status !== "Posted" && receipt.status !== "posted") return;

  const entries = [];
  const date = receipt.date ? new Date(receipt.date).toISOString() : new Date().toISOString();

  let bankCode = "1110";
  let bankTitle = "Bank";
  if (receipt.bankAccount) {
    const b = await getDocumentById("banks", String(receipt.bankAccount));
    if (b) {
      bankCode = b.code || bankCode;
      bankTitle = b.name || b.title || bankTitle;
    }
  }

  const amount = Number(receipt.amount) || 0;
  const remarks = receipt.narration || receipt.notes || "Bank Receipt";
  const partyId = receipt.party || receipt.partyId;

  if (partyId) {
    const party = await getDocumentById("parties", String(partyId));
    const isCustomer = party ? party.type === "Customer" : true;
    const accountCode = isCustomer ? "1100" : "2100";
    const accountTitle = isCustomer ? "Accounts Receivable" : "Accounts Payable";
    const partyType = isCustomer ? "customer" : "vendor";

    entries.push({
      date,
      voucherNo: vNo,
      accountCode: bankCode,
      accountTitle: bankTitle,
      debit: amount,
      credit: 0,
      remarks,
      partyId: null,
      partyType: ""
    });
    entries.push({
      date,
      voucherNo: vNo,
      accountCode,
      accountTitle,
      debit: 0,
      credit: amount,
      remarks,
      partyId,
      partyType
    });
  }

  for (const entry of entries) {
    await createDocument("journal_entries", entry);
  }
}

export async function postBankPaymentJournalEntries(payment: any) {
  await deleteJournalEntriesByVoucherNo(payment.voucherNo);

  if (payment.status !== "Posted" && payment.status !== "posted") return;

  const entries = [];
  const date = payment.date ? new Date(payment.date).toISOString() : new Date().toISOString();

  let bankCode = "1110";
  let bankTitle = "Bank";
  if (payment.bankAccount || payment.bankAccountId) {
    const b = await getDocumentById("banks", String(payment.bankAccount || payment.bankAccountId));
    if (b) {
      bankCode = b.code || bankCode;
      bankTitle = b.name || b.title || bankTitle;
    }
  }

  const amount = Number(payment.amount) || 0;
  const remarks = payment.narration || payment.notes || "Bank Payment";
  const partyId = payment.vendor || payment.partyId;

  if (partyId) {
    const party = await getDocumentById("parties", String(partyId));
    const isCustomer = party ? party.type === "Customer" : false;
    const accountCode = isCustomer ? "1100" : "2100";
    const accountTitle = isCustomer ? "Accounts Receivable" : "Accounts Payable";
    const partyType = isCustomer ? "customer" : "vendor";

    entries.push({
      date,
      voucherNo: payment.voucherNo,
      accountCode,
      accountTitle,
      debit: amount,
      credit: 0,
      remarks,
      partyId,
      partyType
    });
    entries.push({
      date,
      voucherNo: payment.voucherNo,
      accountCode: bankCode,
      accountTitle: bankTitle,
      debit: 0,
      credit: amount,
      remarks,
      partyId: null,
      partyType: ""
    });
  }

  for (const entry of entries) {
    await createDocument("journal_entries", entry);
  }
}

export async function adjustManualBalancesForClosing(partyId: string | null, body: any) {
  if (body.closingBalance === undefined) return body;

  const closingBalance = Number(body.closingBalance) || 0;
  let openingBalance = Number(body.openingBalance) || 0;

  let debitTx = 0;
  let creditTx = 0;

  const isCust = partyId 
    ? (await getDocumentById("parties", partyId))?.type === "Customer" 
    : (body.type === "Customer");

  if (partyId) {
    const party = await getDocumentById("parties", partyId);
    if (!party) return body;

    if (body.openingBalance === undefined) {
      openingBalance = Number(party.openingBalance) || 0;
    }

    const allInvoices = await getDocuments("invoices");
    const invoices = allInvoices.filter((inv: any) => String(inv.partyId) === String(partyId) && inv.status !== "cancelled" && inv.status !== "Cancelled");

    let totalInvoices = 0;
    let totalReturns = 0;

    for (const inv of invoices) {
      const total = Number(inv.totalAmount) || 0;
      const type = inv.type;
      if (isCust) {
        if (["sale", "non_tax_sale", "pos", "challan"].includes(type)) {
          totalInvoices += total;
        } else if (["sale_return", "non_tax_sale_return"].includes(type)) {
          totalReturns += total;
        }
      } else {
        if (["purchase", "non_tax_purchase", "import_purchase"].includes(type)) {
          totalInvoices += total;
        } else if (["purchase_return", "non_tax_purchase_return"].includes(type)) {
          totalReturns += total;
        }
      }
    }

    let totalReceiptsPayments = 0;
    let totalAdjustments = 0;

    const allCashReceipts = await getDocuments("cash_receipts");
    const allBankReceipts = await getDocuments("bank_receipts");
    const allCashPayments = await getDocuments("cash_payments");
    const allBankPayments = await getDocuments("bank_payments");

    if (isCust) {
      const cashReceipts = allCashReceipts.filter((r: any) => String(r.partyId) === String(partyId) && r.status !== "Cancelled");
      const bankReceipts = allBankReceipts.filter((r: any) => (String(r.party) === String(partyId) || String(r.partyId) === String(partyId)) && r.status !== "Cancelled");

      const cashSum = cashReceipts.reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);
      const bankSum = bankReceipts.reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);

      let totalReceivedAtCreation = 0;
      for (const inv of invoices) {
        if (["sale", "non_tax_sale", "pos", "challan"].includes(inv.type)) {
          const invNo = inv.invoiceNo;
          const linkedCashAmt = cashReceipts
            .filter((r: any) => r.reference === invNo || (r.narration && String(r.narration).toLowerCase().includes(String(invNo).toLowerCase())))
            .reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);
          const linkedBankAmt = bankReceipts
            .filter((r: any) => r.instrumentNo === invNo || (r.instrumentNo && String(r.instrumentNo).toLowerCase().includes(String(invNo).toLowerCase())))
            .reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);

          const paidAtCreation = Math.max(0, (Number(inv.amountReceived) || 0) - (linkedCashAmt + linkedBankAmt));
          totalReceivedAtCreation += paidAtCreation;
        }
      }

      totalReceiptsPayments = cashSum + bankSum + totalReceivedAtCreation;

      const cashPayments = allCashPayments.filter((p: any) => (String(p.partyId) === String(partyId) || String(p.vendor) === String(partyId)) && p.status !== "Cancelled");
      const bankPayments = allBankPayments.filter((p: any) => String(p.vendor) === String(partyId) && p.status !== "Cancelled");
      
      totalAdjustments = cashPayments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0) +
                         bankPayments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);

      debitTx = totalInvoices + totalAdjustments;
      creditTx = totalReturns + totalReceiptsPayments;
    } else {
      const cashPayments = allCashPayments.filter((p: any) => (String(p.partyId) === String(partyId) || String(p.vendor) === String(partyId)) && p.status !== "Cancelled");
      const bankPayments = allBankPayments.filter((p: any) => String(p.vendor) === String(partyId) && p.status !== "Cancelled");
      
      const cashSum = cashPayments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
      const bankSum = bankPayments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);

      let totalPaidAtCreation = 0;
      for (const inv of invoices) {
        if (["purchase", "non_tax_purchase", "import_purchase"].includes(inv.type)) {
          const invNo = inv.invoiceNo;
          const linkedCashAmt = cashPayments
            .filter((p: any) => p.reference === invNo || (p.narration && String(p.narration).toLowerCase().includes(String(invNo).toLowerCase())))
            .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
          const linkedBankAmt = bankPayments
            .filter((p: any) => p.instrumentNo === invNo || (p.instrumentNo && String(p.instrumentNo).toLowerCase().includes(String(invNo).toLowerCase())))
            .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);

          const paidAtCreation = Math.max(0, (Number(inv.amountReceived) || 0) - (linkedCashAmt + linkedBankAmt));
          totalPaidAtCreation += paidAtCreation;
        }
      }

      totalReceiptsPayments = cashSum + bankSum + totalPaidAtCreation;

      const cashReceipts = allCashReceipts.filter((r: any) => String(r.partyId) === String(partyId) && r.status !== "Cancelled");
      const bankReceipts = allBankReceipts.filter((r: any) => (String(r.party) === String(partyId) || String(r.partyId) === String(partyId)) && r.status !== "Cancelled");
      
      totalAdjustments = cashReceipts.reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0) +
                         bankReceipts.reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);

      creditTx = totalInvoices + totalAdjustments;
      debitTx = totalReturns + totalReceiptsPayments;
    }
  }

  if (isCust) {
    const diff = closingBalance - openingBalance - debitTx + creditTx;
    if (diff >= 0) {
      body.manualDebit = diff;
      body.manualCredit = 0;
    } else {
      body.manualDebit = 0;
      body.manualCredit = -diff;
    }
  } else {
    const diff = closingBalance - openingBalance - creditTx + debitTx;
    if (diff >= 0) {
      body.manualCredit = diff;
      body.manualDebit = 0;
    } else {
      body.manualCredit = 0;
      body.manualDebit = -diff;
    }
  }

  return body;
}
