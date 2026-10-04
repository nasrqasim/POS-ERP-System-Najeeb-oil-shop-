import { fail, ok } from "@/lib/api";
import { getDocuments, getDocumentById, updateDocument, createDocument } from "@/lib/firestore/genericRepository";
import { recalculatePartyBalance } from "@/services/posting/invoicePostingHelper";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const invoice = await getDocumentById("invoices", params.id);
    if (!invoice) {
      return fail("Invoice not found.", 404);
    }

    const invoiceNo = String(invoice.invoiceNo || "");
    const partyId = invoice.partyId ? String(invoice.partyId) : "";

    const allCashReceipts = await getDocuments("cash_receipts");
    const cashReceipts = allCashReceipts.filter((r: any) => 
      String(r.partyId) === partyId &&
      r.status !== "Cancelled" &&
      (r.reference === invoiceNo || (r.narration && String(r.narration).toLowerCase().includes(invoiceNo.toLowerCase())))
    );

    const allBankReceipts = await getDocuments("bank_receipts");
    const bankReceipts = allBankReceipts.filter((r: any) =>
      (String(r.party) === partyId || String(r.partyId) === partyId) &&
      r.status !== "Cancelled" &&
      (r.instrumentNo === invoiceNo || (r.instrumentNo && String(r.instrumentNo).toLowerCase().includes(invoiceNo.toLowerCase())))
    );

    const history = [
      ...cashReceipts.map((r: any) => ({
        date: r.date,
        voucherNo: r.receiptNumber,
        amountReceived: r.amount,
        paymentMethod: "Cash",
        user: "Super Admin",
      })),
      ...bankReceipts.map((r: any) => ({
        date: r.date,
        voucherNo: r.receiptNumber,
        amountReceived: r.amount,
        paymentMethod: "Bank",
        user: "Super Admin",
      }))
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return ok(history);
  } catch (e) {
    return fail((e as Error).message, 500);
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const { amount, paymentMethod, bankId, date, remarks } = body;

    const paymentAmount = Number(amount) || 0;
    if (paymentAmount <= 0) {
      return fail("Payment amount must be greater than zero.", 400);
    }

    const invoice = await getDocumentById("invoices", params.id);
    if (!invoice) {
      return fail("Invoice not found.", 404);
    }

    const netTotal = Number(invoice.totalAmount) || 0;
    const prevReceived = Number(invoice.amountReceived) || 0;
    const remaining = netTotal - prevReceived;

    if (paymentAmount > remaining) {
      return fail(`Payment amount (${paymentAmount}) exceeds outstanding balance (${remaining}).`, 400);
    }

    const newAmountReceived = prevReceived + paymentAmount;
    const newRemaining = netTotal - newAmountReceived;
    const newStatus = newRemaining <= 0 ? "paid" : invoice.status;

    await updateDocument("invoices", params.id, {
      amountReceived: newAmountReceived,
      status: newStatus
    });

    const cashReceipts = await getDocuments("cash_receipts");
    const bankReceipts = await getDocuments("bank_receipts");
    let attempt = cashReceipts.length + bankReceipts.length + 1;
    const prefix = paymentMethod === "Bank" ? "BRV" : "CRV";
    let receiptNumber = `${prefix}-${attempt.toString().padStart(5, "0")}`;
    
    let isUnique = false;
    while (!isUnique) {
      const matchCash = cashReceipts.find((r: any) => r.receiptNumber === receiptNumber);
      const matchBank = bankReceipts.find((r: any) => r.receiptNumber === receiptNumber);
      if (!matchCash && !matchBank) {
        isUnique = true;
      } else {
        attempt++;
        receiptNumber = `${prefix}-${attempt.toString().padStart(5, "0")}`;
      }
    }

    const narration = remarks || `Payment received against ${invoice.invoiceNo}`;
    const paymentDate = date || new Date().toISOString().split("T")[0];

    if (paymentMethod === "Bank") {
      await createDocument("bank_receipts", {
        receiptNumber,
        date: paymentDate,
        type: "Customer",
        party: invoice.partyId ? String(invoice.partyId) : "",
        partyId: invoice.partyId ? String(invoice.partyId) : "",
        bankAccount: bankId || "",
        amount: paymentAmount,
        netAmount: paymentAmount,
        status: "Posted",
      });

      await createDocument("journal_entries", {
        invoiceId: invoice._id,
        voucherNo: receiptNumber,
        date: new Date(paymentDate).toISOString(),
        accountCode: "1110",
        accountTitle: "Bank",
        debit: paymentAmount,
        credit: 0,
        remarks: narration,
      });

      await createDocument("journal_entries", {
        invoiceId: invoice._id,
        voucherNo: receiptNumber,
        date: new Date(paymentDate).toISOString(),
        accountCode: "1100",
        accountTitle: "Accounts Receivable",
        debit: 0,
        credit: paymentAmount,
        remarks: narration,
        partyId: invoice.partyId || null,
      });
    } else {
      await createDocument("cash_receipts", {
        receiptNumber,
        receiptType: "party",
        date: paymentDate,
        partyId: invoice.partyId || null,
        amount: paymentAmount,
        netAmount: paymentAmount,
        narration,
        status: "Posted",
      });

      await createDocument("journal_entries", {
        invoiceId: invoice._id,
        voucherNo: receiptNumber,
        date: new Date(paymentDate).toISOString(),
        accountCode: "1111",
        accountTitle: "Cash",
        debit: paymentAmount,
        credit: 0,
        remarks: narration,
      });

      await createDocument("journal_entries", {
        invoiceId: invoice._id,
        voucherNo: receiptNumber,
        date: new Date(paymentDate).toISOString(),
        accountCode: "1100",
        accountTitle: "Accounts Receivable",
        debit: 0,
        credit: paymentAmount,
        remarks: narration,
        partyId: invoice.partyId || null,
      });
    }

    if (invoice.partyId) {
      await recalculatePartyBalance(String(invoice.partyId));
    }

    return ok({
      success: true,
      amountReceived: newAmountReceived,
      outstanding: newRemaining,
      status: newStatus
    });
  } catch (e) {
    return fail((e as Error).message, 500);
  }
}
