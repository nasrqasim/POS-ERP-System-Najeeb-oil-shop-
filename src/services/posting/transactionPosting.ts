import { 
  getDocumentById, 
  createDocument, 
  updateDocument 
} from "@/lib/firestore/genericRepository";

type TransactionInput = {
  voucherNo: string;
  date: string;
  partyId?: string;
  accountId?: string;
  bankId?: string;
  cashAccountId?: string;
  amount: number;
  wht?: number;
  netAmount: number;
  narration?: string;
  reference?: string;
  partyPaymentType?: string;
  isRefund?: boolean;
};

export async function postCashPayment(input: TransactionInput) {
  if (input.partyId) {
    const party = await getDocumentById("parties", input.partyId);
    if (party) {
      const currentBal = Number(party.balance || 0);
      await updateDocument("parties", input.partyId, { balance: currentBal - input.amount });
    }
  }

  const payment = await createDocument("cash_payments", {
    voucherNo: input.voucherNo,
    date: input.date,
    partyId: input.partyId,
    vendor: input.partyId,
    amount: input.amount,
    wht: input.wht || 0,
    netPaid: input.netAmount,
    status: "Posted",
    narration: input.narration || "",
    partyPaymentType: input.partyPaymentType || "",
    isRefund: input.isRefund || false
  });

  await createDocument("journal_entries", {
    voucherNo: input.voucherNo,
    accountCode: "2100",
    accountTitle: "Accounts Payable",
    debit: input.amount,
    credit: 0,
    remarks: input.narration || "Cash Payment"
  });
  await createDocument("journal_entries", {
    voucherNo: input.voucherNo,
    accountCode: "1111",
    accountTitle: "Cash",
    debit: 0,
    credit: input.netAmount,
    remarks: input.narration || "Cash Payment"
  });

  if (input.wht && input.wht > 0) {
    await createDocument("journal_entries", {
      voucherNo: input.voucherNo,
      accountCode: "2200",
      accountTitle: "WHT Payable",
      debit: 0,
      credit: input.wht,
      remarks: "WHT on Payment"
    });
  }

  return payment;
}

export async function postCashReceipt(input: TransactionInput) {
  if (input.partyId) {
    const party = await getDocumentById("parties", input.partyId);
    if (party) {
      const currentBal = Number(party.balance || 0);
      await updateDocument("parties", input.partyId, { balance: currentBal - input.amount });
    }
  }

  const receipt = await createDocument("cash_receipts", {
    receiptNumber: input.voucherNo,
    date: input.date,
    partyId: input.partyId,
    party: input.partyId,
    amount: input.amount,
    netAmount: input.amount,
    status: "Posted",
    narration: input.narration || "",
    partyReceiptType: input.partyPaymentType || "Regular"
  });

  await createDocument("journal_entries", {
    voucherNo: input.voucherNo,
    accountCode: "1111",
    accountTitle: "Cash",
    debit: input.amount,
    credit: 0,
    remarks: input.narration || "Cash Receipt"
  });
  await createDocument("journal_entries", {
    voucherNo: input.voucherNo,
    accountCode: "1100",
    accountTitle: "Accounts Receivable",
    debit: 0,
    credit: input.amount,
    remarks: input.narration || "Cash Receipt"
  });

  return receipt;
}

export async function postBankPayment(input: TransactionInput) {
  if (input.partyId) {
    const party = await getDocumentById("parties", input.partyId);
    if (party) {
      const currentBal = Number(party.balance || 0);
      await updateDocument("parties", input.partyId, { balance: currentBal - input.amount });
    }
  }

  if (input.bankId) {
    const bank = await getDocumentById("banks", input.bankId);
    if (bank) {
      const currentBal = Number(bank.balance || 0);
      await updateDocument("banks", input.bankId, { balance: currentBal - input.netAmount });
    }
  }

  const payment = await createDocument("bank_payments", {
    voucherNo: input.voucherNo,
    date: input.date,
    partyId: input.partyId,
    vendor: input.partyId,
    bankAccount: input.bankId,
    bankAccountId: input.bankId,
    amount: input.amount,
    wht: input.wht || 0,
    netPaid: input.netAmount,
    status: "Posted",
    narration: input.narration || "",
    partyPaymentType: input.partyPaymentType || "",
    isRefund: input.isRefund || false
  });

  await createDocument("journal_entries", {
    voucherNo: input.voucherNo,
    accountCode: "2100",
    accountTitle: "Accounts Payable",
    debit: input.amount,
    credit: 0,
    remarks: input.narration || "Bank Payment"
  });
  await createDocument("journal_entries", {
    voucherNo: input.voucherNo,
    accountCode: "1110",
    accountTitle: "Bank",
    debit: 0,
    credit: input.netAmount,
    remarks: input.narration || "Bank Payment"
  });

  return payment;
}

export async function postBankReceipt(input: TransactionInput) {
  if (input.partyId) {
    const party = await getDocumentById("parties", input.partyId);
    if (party) {
      const currentBal = Number(party.balance || 0);
      await updateDocument("parties", input.partyId, { balance: currentBal - input.amount });
    }
  }

  if (input.bankId) {
    const bank = await getDocumentById("banks", input.bankId);
    if (bank) {
      const currentBal = Number(bank.balance || 0);
      await updateDocument("banks", input.bankId, { balance: currentBal + input.amount });
    }
  }

  const receipt = await createDocument("bank_receipts", {
    receiptNumber: input.voucherNo,
    date: input.date,
    partyId: input.partyId,
    party: input.partyId,
    bankAccount: input.bankId,
    amount: input.amount,
    netAmount: input.amount,
    status: "Posted",
    narration: input.narration || ""
  });

  await createDocument("journal_entries", {
    voucherNo: input.voucherNo,
    accountCode: "1110",
    accountTitle: "Bank",
    debit: input.amount,
    credit: 0,
    remarks: input.narration || "Bank Receipt"
  });
  await createDocument("journal_entries", {
    voucherNo: input.voucherNo,
    accountCode: "1100",
    accountTitle: "Accounts Receivable",
    debit: 0,
    credit: input.amount,
    remarks: input.narration || "Bank Receipt"
  });

  return receipt;
}
