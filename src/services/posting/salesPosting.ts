import { 
  getDocumentById, 
  createDocument, 
  updateDocument 
} from "@/lib/firestore/genericRepository";

type SalesInput = {
  invoiceNo: string;
  partyId: string;
  regNo?: string;
  startKms?: number;
  endKms?: number;
  oilGaugeLimit?: number;
  lines: Array<{
    itemId: string;
    qty?: number;
    cartons?: number;
    rate?: number;
    ratePerCarton?: number;
    discountPercent?: number;
  }>;
  paymentMethod?: string;
};

export async function postSalesInvoice(input: SalesInput) {
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
      await updateDocument("items", line.itemId, { stockQtyCartons: currentStock - line.qty });
    }
  }

  if (input.paymentMethod !== "Cash" && input.paymentMethod !== "Card") {
    const party = await getDocumentById("parties", input.partyId);
    if (party) {
      const currentBal = Number(party.balance || 0);
      await updateDocument("parties", input.partyId, { balance: currentBal + total });
    }
  }

  const invoice = await createDocument("invoices", {
    invoiceNo: input.invoiceNo,
    type: "sale",
    partyId: input.partyId,
    regNo: input.regNo ?? "",
    startKms: input.startKms ?? 0,
    endKms: input.endKms ?? 0,
    rangeKms: (input.endKms ?? 0) - (input.startKms ?? 0),
    oilGaugeLimit: input.oilGaugeLimit ?? 0,
    lines,
    totalAmount: total,
    status: "posted",
    paymentMethod: input.paymentMethod || "Credit",
  });

  const isCash = input.paymentMethod === "Cash" || input.paymentMethod === "Card";
  const isBank = input.paymentMethod === "Bank" || input.paymentMethod === "Online";
  const assetCode = isCash ? "1111" : isBank ? "1110" : "1100";
  const assetTitle = isCash ? "Cash" : isBank ? "Bank" : "Accounts Receivable";

  await createDocument("journal_entries", {
    invoiceId: invoice._id,
    accountCode: assetCode,
    accountTitle: assetTitle,
    debit: total,
    credit: 0,
    remarks: `Sales invoice posted (${input.paymentMethod || "Credit"})`
  });
  await createDocument("journal_entries", {
    invoiceId: invoice._id,
    accountCode: "4100",
    accountTitle: "Sales",
    debit: 0,
    credit: total,
    remarks: "Sales invoice posted"
  });

  if (input.regNo) {
    await createDocument("vehicle_logs", {
      regNo: input.regNo,
      invoiceId: invoice._id,
      startKms: input.startKms ?? 0,
      endKms: input.endKms ?? 0,
    });
  }

  return invoice;
}

export async function postSaleReturn(input: { invoiceNo: string; partyId: string; linkedInvoiceId: string; lines: SalesInput["lines"]; paymentMethod?: string }) {
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
      await updateDocument("items", line.itemId, { stockQtyCartons: currentStock + (line.cartons || 0) });
    }
  }

  const party = await getDocumentById("parties", input.partyId);
  if (party) {
    const currentBal = Number(party.balance || 0);
    await updateDocument("parties", input.partyId, { balance: currentBal - total });
  }

  const invoice = await createDocument("invoices", {
    invoiceNo: input.invoiceNo,
    type: "sale_return",
    partyId: input.partyId,
    linkedInvoiceId: input.linkedInvoiceId,
    lines,
    totalAmount: total,
    status: "posted"
  });

  const isCash = input.paymentMethod === "Cash" || input.paymentMethod === "Card";
  const isBank = input.paymentMethod === "Bank" || input.paymentMethod === "Online";
  const assetCode = isCash ? "1111" : isBank ? "1110" : "1100";
  const assetTitle = isCash ? "Cash" : isBank ? "Bank" : "Accounts Receivable";

  await createDocument("journal_entries", {
    invoiceId: invoice._id,
    accountCode: "4100",
    accountTitle: "Sales Return",
    debit: total,
    credit: 0,
    remarks: "Sales return posted"
  });
  await createDocument("journal_entries", {
    invoiceId: invoice._id,
    accountCode: assetCode,
    accountTitle: assetTitle,
    debit: 0,
    credit: total,
    remarks: "Sales return posted"
  });

  return invoice;
}
