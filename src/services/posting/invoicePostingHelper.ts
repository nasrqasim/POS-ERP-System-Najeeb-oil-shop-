import JournalEntry from "@/models/JournalEntry";
import Party from "@/models/Party";
import Invoice from "@/models/Invoice";
import CashPayment from "@/models/CashPayment";
import BankPayment from "@/models/BankPayment";
import CashReceipt from "@/models/CashReceipt";
import BankReceipt from "@/models/BankReceipt";
import Account from "@/models/Account";
import Bank from "@/models/Bank";

async function getOrCreateTaxAccount() {
  let acc = await Account.findOne({
    $or: [
      { code: "Tax on Purchased Items" },
      { code: "Tax on Purchased items" },
      { title: { $regex: /^tax on purchased items$/i } }
    ]
  });
  if (!acc) {
    acc = await Account.create({
      code: "Tax on Purchased Items",
      title: "Tax on Purchased Items",
      type: "expense",
      openingBalance: 0
    });
  }
  return acc;
}

export async function recalculatePartyBalance(partyId: string) {
  if (!partyId) return;

  const party = await Party.findById(partyId);
  if (!party) return;

  // Walk-in Customer Fix: always force balance, debit, and credit to 0
  if ((party.name || party.companyName || "").toLowerCase().includes("walk-in")) {
    await Party.findByIdAndUpdate(partyId, { debit: 0, credit: 0, balance: 0 });
    return;
  }

  const isCustomer = party.type === "Customer";
  const openingBalance = Number(party.openingBalance) || 0;

  let totalInvoices = 0;
  let totalReturns = 0;
  let totalReceiptsPayments = 0;
  let totalAdjustments = 0; // payments to customer or receipts from vendor

  // 1. Sum up all invoices for this party
  const invoices = await Invoice.find({ partyId, status: { $ne: "cancelled" } }).lean();
  for (const inv of invoices) {
    const total = Number(inv.totalAmount) || 0;
    const type = inv.type;
    if (type === "sale" || type === "non_tax_sale" || type === "pos" || type === "challan") {
      totalInvoices += total;
    } else if (type === "sale_return" || type === "non_tax_sale_return") {
      totalReturns += total;
    } else if (type === "purchase" || type === "non_tax_purchase" || type === "import_purchase") {
      totalInvoices += total;
    } else if (type === "purchase_return" || type === "non_tax_purchase_return") {
      totalReturns += total;
    }
  }

  // 2. Sum up all receipts / payments for this party
  if (isCustomer) {
    const cashReceipts = await CashReceipt.find({ partyId, status: { $ne: "Cancelled" } }).lean();
    const bankReceipts = await BankReceipt.find({
      $or: [{ party: partyId }, { party: String(partyId) }],
      status: { $ne: "Cancelled" },
    }).lean();

    const cashSum = cashReceipts.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const bankSum = bankReceipts.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

    // Compute total received at creation time for invoices (which does not have a CashReceipt/BankReceipt document)
    let totalReceivedAtCreation = 0;
    for (const inv of invoices) {
      if (["sale", "non_tax_sale", "pos", "challan"].includes(inv.type)) {
        const invNo = inv.invoiceNo;
        const linkedCashAmt = cashReceipts
          .filter((r: any) => r.reference === invNo || (r.narration && r.narration.toLowerCase().includes(invNo.toLowerCase())))
          .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
        const linkedBankAmt = bankReceipts
          .filter((r: any) => r.instrumentNo === invNo || (r.instrumentNo && r.instrumentNo.toLowerCase().includes(invNo.toLowerCase())))
          .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

        const paidAtCreation = Math.max(0, (Number(inv.amountReceived) || 0) - (linkedCashAmt + linkedBankAmt));
        totalReceivedAtCreation += paidAtCreation;
      }
    }

    totalReceiptsPayments = cashSum + bankSum + totalReceivedAtCreation;

    // Payments to Customer (Debit adjustments, e.g. CPV-00010)
    const cashPayments = await CashPayment.find({
      $or: [{ partyId }, { vendor: partyId }],
      status: { $ne: "Cancelled" },
    }).lean();
    const bankPayments = await BankPayment.find({ vendor: partyId, status: { $ne: "Cancelled" } }).lean();
    
    totalAdjustments = cashPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) +
                       bankPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  } else {
    const cashPayments = await CashPayment.find({
      $or: [{ partyId }, { vendor: partyId }],
      status: { $ne: "Cancelled" },
    }).lean();
    const bankPayments = await BankPayment.find({ vendor: partyId, status: { $ne: "Cancelled" } }).lean();
    
    const cashSum = cashPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const bankSum = bankPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    // Compute total paid at creation time for invoices (which does not have a CashPayment/BankPayment document)
    let totalPaidAtCreation = 0;
    for (const inv of invoices) {
      if (["purchase", "non_tax_purchase", "import_purchase"].includes(inv.type)) {
        const invNo = inv.invoiceNo;
        const linkedCashAmt = cashPayments
          .filter((p: any) => p.reference === invNo || (p.narration && p.narration.toLowerCase().includes(invNo.toLowerCase())))
          .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        const linkedBankAmt = bankPayments
          .filter((p: any) => p.instrumentNo === invNo || (p.instrumentNo && p.instrumentNo.toLowerCase().includes(invNo.toLowerCase())))
          .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

        const totalInvAmt = Number(inv.totalAmount) || 0;
        const rawPaid = (Number(inv.amountReceived) > 0 ? Number(inv.amountReceived) : 0) ||
                        (Number(inv.amountPaid) > 0 ? Number(inv.amountPaid) : 0) ||
                        ((inv.paymentMethod === "Cash" || inv.paymentMethod === "Bank" || inv.status === "paid" || inv.balance === 0) ? totalInvAmt : 0);

        const paidAtCreation = Math.max(0, rawPaid - (linkedCashAmt + linkedBankAmt));
        totalPaidAtCreation += paidAtCreation;
      }
    }

    totalReceiptsPayments = cashSum + bankSum + totalPaidAtCreation;

    // Receipts from Vendor (Credit adjustments)
    const cashReceipts = await CashReceipt.find({ partyId, status: { $ne: "Cancelled" } }).lean();
    const bankReceipts = await BankReceipt.find({
      $or: [{ party: partyId }, { party: String(partyId) }],
      status: { $ne: "Cancelled" },
    }).lean();
    
    totalAdjustments = cashReceipts.reduce((sum, r) => sum + (Number(r.amount) || 0), 0) +
                       bankReceipts.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  }

  let debit = 0;
  let credit = 0;
  let balance = 0;

  if (isCustomer) {
    // Debit side = manual debit + period sales + period payments to customer
    debit = (party.manualDebit || 0) + totalInvoices + totalAdjustments;
    // Credit side = manual credit + period returns + period receipts from customer
    credit = (party.manualCredit || 0) + totalReturns + totalReceiptsPayments;
    // Closing balance = opening balance (natural Debit) + debits - credits
    balance = openingBalance + debit - credit;
  } else {
    // Credit side = manual credit + period purchases + period receipts from vendor
    credit = (party.manualCredit || 0) + totalInvoices + totalAdjustments;
    // Debit side = manual debit + period returns + period payments to vendor
    debit = (party.manualDebit || 0) + totalReturns + totalReceiptsPayments;
    // Closing balance = opening balance (natural Credit) + credits - debits
    balance = openingBalance + credit - debit;
  }

  await Party.findByIdAndUpdate(partyId, { debit, credit, balance });
}

export async function generateInvoiceJournalEntries(invoice: any) {
  await JournalEntry.deleteMany({ invoiceId: invoice._id });

  const total = Number(invoice.totalAmount) || 0;
  if (total <= 0) {
    if (invoice.partyId) {
      await recalculatePartyBalance(invoice.partyId.toString());
    }
    return;
  }

  const voucherNo = invoice.invoiceNo || `INV-${invoice._id}`;
  const date = invoice.date || invoice.createdAt || new Date();
  const paymentMethod = invoice.paymentMethod || invoice.paymentTerms || "Credit";

  // Check if customer is Walk-in Cash Customer
  let isWalkIn = false;
  if (invoice.partyId) {
    const party = await Party.findById(invoice.partyId).lean() as any;
    if (party && (party.name || party.companyName || "").toLowerCase().includes("walk-in")) {
      isWalkIn = true;
    }
  }

  const isCash = paymentMethod === "Cash" || paymentMethod === "Card" || isWalkIn;
  const isBank = paymentMethod === "Bank" || paymentMethod === "Online";

  // Determine Asset / Balance Sheet Accounts
  const assetCode = (isCash || isWalkIn) ? (isBank ? "1110" : "1111") : "1100";
  const assetTitle = (isCash || isWalkIn) ? (isBank ? "Bank" : "Cash") : "Accounts Receivable";

  const liabilityCode = isCash ? "1111" : isBank ? "1110" : "2100";
  const liabilityTitle = isCash ? "Cash" : isBank ? "Bank" : "Accounts Payable";

  if (invoice.type === "sale" || invoice.type === "pos" || invoice.type === "non_tax_sale") {
    const entries = [
      {
        invoiceId: invoice._id,
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
        invoiceId: invoice._id,
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
        invoiceId: invoice._id,
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
        invoiceId: invoice._id,
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

    // Customer advance usage entries
    if (invoice.useAdvance && invoice.advanceAmountUsed > 0) {
      entries.push({
        invoiceId: invoice._id,
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
        invoiceId: invoice._id,
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

    await JournalEntry.create(entries);
  } else if (invoice.type === "sale_return" || invoice.type === "non_tax_sale_return") {
    await JournalEntry.create([
      {
        invoiceId: invoice._id,
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
        invoiceId: invoice._id,
        voucherNo,
        date,
        accountCode: assetCode,
        accountTitle: assetTitle,
        debit: 0,
        credit: total,
        remarks: `${invoice.type === "non_tax_sale_return" ? "Non-Tax " : ""}Sales return posted`,
        partyId: invoice.partyId || null
      }
    ]);
  } else if (invoice.type === "purchase" || invoice.type === "non_tax_purchase" || invoice.type === "import_purchase") {
    const taxAmount = Number(invoice.taxAmount) || 0;
    const subTotal = Number(invoice.subTotal) || 0;
    const discountAmount = Number(invoice.discountAmount) || 0;
    const purchasesAmt = Math.max(0, subTotal - discountAmount);

    // Calculate additional purchase expenses
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

    // 1. Debit Purchases
    entries.push({
      invoiceId: invoice._id,
      voucherNo,
      date,
      accountCode: "5100",
      accountTitle: "Purchases",
      debit: purchasesAmt,
      credit: 0,
      remarks: `${invoice.type === "non_tax_purchase" ? "Non-Tax " : ""}Purchase invoice posted (${paymentMethod})`,
      partyId: invoice.partyId || null
    });

    // 2. Debit Expenses (if expenses exist)
    if (Array.isArray(invoice.expenses) && invoice.expenses.length > 0) {
      for (const exp of invoice.expenses) {
        if (Number(exp.amount) > 0) {
          entries.push({
            invoiceId: invoice._id,
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
        invoiceId: invoice._id,
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

    // 3. Debit Tax Account (if tax exists)
    if (taxAmount > 0) {
      const taxAcc = await getOrCreateTaxAccount();
      let vendorName = "";
      if (invoice.partyId) {
        const party = await Party.findById(invoice.partyId).lean();
        if (party) {
          vendorName = (party as any).companyName || (party as any).name || "";
        }
      }
      entries.push({
        invoiceId: invoice._id,
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

    // 4. Credit Paid Portion (Cash or Bank)
    if (paidPortion > 0) {
      const payMethod = (paymentMethod === "Bank" || invoice.paymentMethod === "Bank") ? "1110" : "1111";
      const payTitle = (paymentMethod === "Bank" || invoice.paymentMethod === "Bank") ? "Bank" : "Cash";
      entries.push({
        invoiceId: invoice._id,
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

    // 5. Credit Unpaid Portion (Accounts Payable)
    if (unpaidPortion > 0) {
      entries.push({
        invoiceId: invoice._id,
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

    await JournalEntry.create(entries);
  } else if (invoice.type === "purchase_order" || invoice.type === "grn") {
    if (invoice.amountReceived > 0) {
      const payMethod = invoice.paymentMethod === "Bank" ? "1110" : "1111";
      const payTitle = invoice.paymentMethod === "Bank" ? "Bank" : "Cash";
      await JournalEntry.create([
        {
          invoiceId: invoice._id,
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
          invoiceId: invoice._id,
          voucherNo,
          date,
          accountCode: payMethod,
          accountTitle: payTitle,
          debit: 0,
          credit: invoice.amountReceived,
          remarks: `Payment made at ${invoice.type === "grn" ? "GRN" : "PO"}`,
          partyId: null
        }
      ]);
    }
  } else if (invoice.type === "purchase_return" || invoice.type === "non_tax_purchase_return") {
    await JournalEntry.create([
      {
        invoiceId: invoice._id,
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
        invoiceId: invoice._id,
        voucherNo,
        date,
        accountCode: "5101",
        accountTitle: "Purchase Return",
        debit: 0,
        credit: total,
        remarks: `${invoice.type === "non_tax_purchase_return" ? "Non-Tax " : ""}Purchase return posted`,
        partyId: invoice.partyId || null
      }
    ]);
  }

  if (invoice.partyId) {
    await recalculatePartyBalance(invoice.partyId.toString());
  }
}

export async function getCustomerAdvanceStats(customerId: string) {
  const entries = await JournalEntry.find({ accountCode: "2120" }).lean();
  // Filter entries linked to this customer's cash/bank receipts and payments
  const customerReceipts = await CashReceipt.find({ partyId: customerId, status: { $ne: "Cancelled" }, partyReceiptType: { $in: ["Advance", "Deposit", "Extra Cash"] } }).lean();
  const receiptVouchers = new Set(customerReceipts.map((r: any) => r.receiptNumber));
  
  let totalAdvance = 0;
  let totalUsed = 0;
  let totalRefunded = 0;

  for (const entry of entries) {
    const e = entry as any;
    if (receiptVouchers.has(e.voucherNo)) {
      totalAdvance += e.credit || 0;
    }
    // Debits to 2120 = advance used or refunded
    if (e.debit > 0 && e.partyId && String(e.partyId) === String(customerId)) {
      totalRefunded += e.debit;
    }
  }

  // Also check invoice-linked advance usage
  const invoices = await Invoice.find({ partyId: customerId, useAdvance: true, advanceAmountUsed: { $gt: 0 } }).lean();
  totalUsed = invoices.reduce((sum: number, inv: any) => sum + (Number(inv.advanceAmountUsed) || 0), 0);
  
  // Total refunded from cash/bank payments marked as refund
  const cashPaymentRefunds = await CashPayment.find({ partyId: customerId, isRefund: true, status: "Posted" }).lean();
  const bankPaymentRefunds = await BankPayment.find({ vendor: customerId, isRefund: true, status: "Posted" }).lean();
  totalRefunded = cashPaymentRefunds.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0) +
                  bankPaymentRefunds.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);

  const remainingAdvance = Math.max(0, totalAdvance - totalUsed - totalRefunded);

  return { totalAdvance, totalUsed, totalRefunded, remainingAdvance };
}

export async function postCashReceiptJournalEntries(receipt: any) {
  await JournalEntry.deleteMany({ voucherNo: receipt.receiptNumber });

  if (receipt.status !== "Posted") return;

  const entries = [];
  const date = receipt.date ? new Date(receipt.date) : new Date();
  
  let cashCode = "00786";
  let cashTitle = "Cash Hand";
  if (receipt.cashAccountId) {
    const acc = await Account.findById(receipt.cashAccountId).lean();
    if (acc) {
      cashCode = (acc as any).code || cashCode;
      cashTitle = (acc as any).title || cashTitle;
    }
  }

  const receiptType = receipt.receiptType || "party";
  const amount = Number(receipt.amount) || 0;
  const remarks = receipt.narration || receipt.notes || "Cash Receipt";

  if (receipt.partyId) {
    const party = await Party.findById(receipt.partyId).lean() as any;
    const isCustomer = party ? party.type === "Customer" : true;
    const isAdvance = ["Advance", "Deposit", "Extra Cash"].includes(receipt.partyReceiptType);
    
    let accountCode = isCustomer ? "1100" : "2100";
    let accountTitle = isCustomer ? "Accounts Receivable" : "Accounts Payable";
    
    // For advance/deposit receipts from customers, use Customer Advance Liability account
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
        const acc = await Account.findById(line.accountId).lean();
        if (acc) {
          code = (acc as any).code || code;
          title = (acc as any).title || title;
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
      const party = await Party.findById(line.partyId).lean() as any;
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

  if (entries.length > 0) {
    await JournalEntry.create(entries);
  }
}

export async function postCashPaymentJournalEntries(payment: any) {
  await JournalEntry.deleteMany({ voucherNo: payment.voucherNo });

  if (payment.status !== "Posted") return;

  const entries = [];
  const date = payment.date ? new Date(payment.date) : new Date();

  let cashCode = "00786";
  let cashTitle = "Cash Hand";
  if (payment.cashAccountId) {
    const acc = await Account.findById(payment.cashAccountId).lean();
    if (acc) {
      cashCode = (acc as any).code || cashCode;
      cashTitle = (acc as any).title || cashTitle;
    }
  }

  const paymentType = payment.paymentType || "party";
  const amount = Number(payment.amount) || 0;
  const remarks = payment.narration || payment.notes || "Cash Payment";

  if (payment.partyId) {
    const party = await Party.findById(payment.partyId).lean() as any;
    const isCustomer = party ? party.type === "Customer" : false;
    const isAdvanceRefund = isCustomer && (payment.isRefund || payment.partyPaymentType === "Refund");
    
    let accountCode = isCustomer ? "1100" : "2100";
    let accountTitle = isCustomer ? "Accounts Receivable" : "Accounts Payable";
    
    // For advance refunds to customers, use Customer Advance Liability account
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
        const acc = await Account.findById(line.accountId).lean();
        if (acc) {
          code = (acc as any).code || code;
          title = (acc as any).title || title;
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

  if (entries.length > 0) {
    await JournalEntry.create(entries);
  }
}

export async function postBankReceiptJournalEntries(receipt: any) {
  const vNo = receipt.receiptNumber || receipt.voucherNo;
  await JournalEntry.deleteMany({ voucherNo: vNo });

  if (receipt.status !== "Posted" && receipt.status !== "posted") return;

  const entries = [];
  const date = receipt.date ? new Date(receipt.date) : new Date();

  let bankCode = "1110";
  let bankTitle = "Bank";
  if (receipt.bankAccount) {
    const b = await Bank.findById(receipt.bankAccount).lean();
    if (b) {
      bankCode = (b as any).code || bankCode;
      bankTitle = (b as any).name || (b as any).title || bankTitle;
    }
  }

  const amount = Number(receipt.amount) || 0;
  const remarks = receipt.narration || receipt.notes || "Bank Receipt";
  const partyId = receipt.party || receipt.partyId;

  if (partyId) {
    const party = await Party.findById(partyId).lean() as any;
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

  if (entries.length > 0) {
    await JournalEntry.create(entries);
  }
}

export async function postBankPaymentJournalEntries(payment: any) {
  await JournalEntry.deleteMany({ voucherNo: payment.voucherNo });

  if (payment.status !== "Posted" && payment.status !== "posted") return;

  const entries = [];
  const date = payment.date ? new Date(payment.date) : new Date();

  let bankCode = "1110";
  let bankTitle = "Bank";
  if (payment.bankAccount || payment.bankAccountId) {
    const b = await Bank.findById(payment.bankAccount || payment.bankAccountId).lean();
    if (b) {
      bankCode = (b as any).code || bankCode;
      bankTitle = (b as any).name || (b as any).title || bankTitle;
    }
  }

  const amount = Number(payment.amount) || 0;
  const remarks = payment.narration || payment.notes || "Bank Payment";
  const partyId = payment.vendor || payment.partyId;

  if (partyId) {
    const party = await Party.findById(partyId).lean() as any;
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

  if (entries.length > 0) {
    await JournalEntry.create(entries);
  }
}

export async function adjustManualBalancesForClosing(partyId: string | null, body: any) {
  if (body.closingBalance === undefined) return body;

  const closingBalance = Number(body.closingBalance) || 0;
  let openingBalance = Number(body.openingBalance) || 0;

  let debitTx = 0;
  let creditTx = 0;

  const isCust = partyId 
    ? (await Party.findById(partyId).lean() as any)?.type === "Customer" 
    : (body.type === "Customer");

  if (partyId) {
    const party = await Party.findById(partyId).lean() as any;
    if (!party) return body;

    if (body.openingBalance === undefined) {
      openingBalance = Number(party.openingBalance) || 0;
    }

    // 1. Sum up all invoices for this party
    const invoices = await Invoice.find({ partyId, status: { $ne: "cancelled" } }).lean();
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

    // 2. Sum up all receipts / payments for this party
    let totalReceiptsPayments = 0;
    let totalAdjustments = 0;

    if (isCust) {
      const cashReceipts = await CashReceipt.find({ partyId, status: { $ne: "Cancelled" } }).lean();
      const bankReceipts = await BankReceipt.find({
        $or: [{ party: partyId }, { party: String(partyId) }],
        status: { $ne: "Cancelled" },
      }).lean();

      const cashSum = cashReceipts.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
      const bankSum = bankReceipts.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

      let totalReceivedAtCreation = 0;
      for (const inv of invoices) {
        if (["sale", "non_tax_sale", "pos", "challan"].includes(inv.type)) {
          const invNo = inv.invoiceNo;
          const linkedCashAmt = cashReceipts
            .filter((r: any) => r.reference === invNo || (r.narration && r.narration.toLowerCase().includes(invNo.toLowerCase())))
            .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
          const linkedBankAmt = bankReceipts
            .filter((r: any) => r.instrumentNo === invNo || (r.instrumentNo && r.instrumentNo.toLowerCase().includes(invNo.toLowerCase())))
            .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

          const paidAtCreation = Math.max(0, (Number(inv.amountReceived) || 0) - (linkedCashAmt + linkedBankAmt));
          totalReceivedAtCreation += paidAtCreation;
        }
      }

      totalReceiptsPayments = cashSum + bankSum + totalReceivedAtCreation;

      const cashPayments = await CashPayment.find({
        $or: [{ partyId }, { vendor: partyId }],
        status: { $ne: "Cancelled" },
      }).lean();
      const bankPayments = await BankPayment.find({ vendor: partyId, status: { $ne: "Cancelled" } }).lean();
      
      totalAdjustments = cashPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) +
                         bankPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

      debitTx = totalInvoices + totalAdjustments;
      creditTx = totalReturns + totalReceiptsPayments;
    } else {
      const cashPayments = await CashPayment.find({
        $or: [{ partyId }, { vendor: partyId }],
        status: { $ne: "Cancelled" },
      }).lean();
      const bankPayments = await BankPayment.find({ vendor: partyId, status: { $ne: "Cancelled" } }).lean();
      
      const cashSum = cashPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const bankSum = bankPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

      let totalPaidAtCreation = 0;
      for (const inv of invoices) {
        if (["purchase", "non_tax_purchase", "import_purchase"].includes(inv.type)) {
          const invNo = inv.invoiceNo;
          const linkedCashAmt = cashPayments
            .filter((p: any) => p.reference === invNo || (p.narration && p.narration.toLowerCase().includes(invNo.toLowerCase())))
            .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
          const linkedBankAmt = bankPayments
            .filter((p: any) => p.instrumentNo === invNo || (p.instrumentNo && p.instrumentNo.toLowerCase().includes(invNo.toLowerCase())))
            .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

          const paidAtCreation = Math.max(0, (Number(inv.amountReceived) || 0) - (linkedCashAmt + linkedBankAmt));
          totalPaidAtCreation += paidAtCreation;
        }
      }

      totalReceiptsPayments = cashSum + bankSum + totalPaidAtCreation;

      const cashReceipts = await CashReceipt.find({ partyId, status: { $ne: "Cancelled" } }).lean();
      const bankReceipts = await BankReceipt.find({
        $or: [{ party: partyId }, { party: String(partyId) }],
        status: { $ne: "Cancelled" },
      }).lean();
      
      totalAdjustments = cashReceipts.reduce((sum, r) => sum + (Number(r.amount) || 0), 0) +
                         bankReceipts.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

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

