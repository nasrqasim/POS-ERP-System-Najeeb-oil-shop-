import { 
  getDocumentById, 
  createDocument, 
  updateDocument 
} from "@/lib/firestore/genericRepository";

type PurchaseInput = {
  invoiceNo: string;
  partyId: string;
  lines: Array<{
    itemId: string;
    qty?: number;
    cartons?: number;
    rate?: number;
    ratePerCarton?: number;
    discountPercent?: number;
  }>;
};

export async function postPurchaseInvoice(input: PurchaseInput) {
  let total = 0;
  const lines = input.lines.map((line) => {
    const qty = line.qty ?? line.cartons ?? 0;
    const rate = line.rate ?? line.ratePerCarton ?? 0;
    const grossAmount = qty * rate;
    const discountPercent = line.discountPercent ?? 0;
    const netAmount = grossAmount - (grossAmount * discountPercent) / 100;
    total += netAmount;
    return { ...line, qty, rate, grossAmount, discountPercent, netAmount };
  });

  for (const line of lines) {
    const item = await getDocumentById("items", line.itemId);
    if (item) {
      const currentStock = Number(item.stockQtyCartons || item.stockQty || 0);
      await updateDocument("items", line.itemId, { 
        stockQtyCartons: currentStock + line.qty,
        purchaseRate: line.rate
      });
    }
  }

  const party = await getDocumentById("parties", input.partyId);
  if (party) {
    const currentBal = Number(party.balance || 0);
    await updateDocument("parties", input.partyId, { balance: currentBal + total });
  }

  const invoice = await createDocument("invoices", {
    invoiceNo: input.invoiceNo,
    type: "purchase",
    partyId: input.partyId,
    lines,
    totalAmount: total,
    status: "posted"
  });

  await createDocument("journal_entries", {
    invoiceId: invoice._id,
    accountCode: "1200",
    accountTitle: "Inventory",
    debit: total,
    credit: 0,
    remarks: "Purchase posted"
  });
  await createDocument("journal_entries", {
    invoiceId: invoice._id,
    accountCode: "2100",
    accountTitle: "Accounts Payable",
    debit: 0,
    credit: total,
    remarks: "Purchase posted"
  });

  return invoice;
}

export async function postPurchaseReturn(input: { invoiceNo: string; partyId: string; linkedInvoiceId: string; lines: PurchaseInput["lines"] }) {
  let total = 0;
  const lines = input.lines.map((line) => {
    const grossAmount = (line.cartons || 0) * (line.ratePerCarton || 0);
    const discountPercent = line.discountPercent ?? 0;
    const netAmount = grossAmount - (grossAmount * discountPercent) / 100;
    total += netAmount;
    return { ...line, grossAmount, discountPercent, netAmount };
  });

  for (const line of lines) {
    const item = await getDocumentById("items", line.itemId);
    if (item) {
      const currentStock = Number(item.stockQtyCartons || item.stockQty || 0);
      await updateDocument("items", line.itemId, { stockQtyCartons: currentStock - (line.cartons || 0) });
    }
  }

  const party = await getDocumentById("parties", input.partyId);
  if (party) {
    const currentBal = Number(party.balance || 0);
    await updateDocument("parties", input.partyId, { balance: currentBal - total });
  }

  const invoice = await createDocument("invoices", {
    invoiceNo: input.invoiceNo,
    type: "purchase_return",
    partyId: input.partyId,
    linkedInvoiceId: input.linkedInvoiceId,
    lines,
    totalAmount: total,
    status: "posted"
  });

  await createDocument("journal_entries", {
    invoiceId: invoice._id,
    accountCode: "2100",
    accountTitle: "Accounts Payable",
    debit: total,
    credit: 0,
    remarks: "Purchase return posted"
  });
  await createDocument("journal_entries", {
    invoiceId: invoice._id,
    accountCode: "1200",
    accountTitle: "Inventory",
    debit: 0,
    credit: total,
    remarks: "Purchase return posted"
  });

  return invoice;
}
