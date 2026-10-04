import { fail, ok } from "@/lib/api";
import { getDocuments, getDocumentById, createDocument, deleteDocument } from "@/lib/firestore/genericRepository";
import { recalculatePartyBalance, deleteJournalEntriesByVoucherNo } from "@/services/posting/invoicePostingHelper";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await req.json();

    const original = await getDocumentById("journal_entries", id);
    if (!original) return fail("Journal entry not found");

    const oldVoucherNo = original.voucherNo;

    await deleteJournalEntriesByVoucherNo(oldVoucherNo);

    const newEntries = Array.isArray(body.entries) ? body.entries : [body];
    const created = [];
    for (const entry of newEntries) {
      const row = await createDocument("journal_entries", entry);
      created.push(row);
    }

    const partyId = body.partyId;
    const partyType = body.partyType;

    const allPayments = await getDocuments("cash_payments");
    const oldPayments = allPayments.filter((p: any) => p.voucherNo === oldVoucherNo);
    for (const p of oldPayments) {
      await deleteDocument("cash_payments", p._id);
      if (p.partyId) await recalculatePartyBalance(String(p.partyId));
    }

    const allReceipts = await getDocuments("cash_receipts");
    const oldReceipts = allReceipts.filter((r: any) => r.receiptNumber === oldVoucherNo);
    for (const r of oldReceipts) {
      await deleteDocument("cash_receipts", r._id);
      if (r.partyId) await recalculatePartyBalance(String(r.partyId));
    }

    if (partyId && partyType) {
      const amount = Number(body.amount) || 0;
      const date = body.date || new Date().toISOString().split("T")[0];
      const remarks = body.remarks || "";
      const voucherNo = body.voucherNo || oldVoucherNo;

      if (partyType === "vendor") {
        await createDocument("cash_payments", {
          voucherNo,
          paymentType: "party",
          date,
          partyId: String(partyId),
          vendor: String(partyId),
          amount,
          narration: remarks,
          status: "Posted",
        });
        await recalculatePartyBalance(String(partyId));
      } else if (partyType === "customer") {
        await createDocument("cash_receipts", {
          receiptNumber: voucherNo,
          receiptType: "party",
          date,
          partyId: String(partyId),
          amount,
          narration: remarks,
          status: "Posted",
        });
        await recalculatePartyBalance(String(partyId));
      }
    }

    return ok(created);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const entry = await getDocumentById("journal_entries", id);
    if (!entry) return fail("Journal entry not found");

    const voucherNo = entry.voucherNo;

    await deleteJournalEntriesByVoucherNo(voucherNo);

    const allPayments = await getDocuments("cash_payments");
    const oldPayments = allPayments.filter((p: any) => p.voucherNo === voucherNo);
    for (const p of oldPayments) {
      await deleteDocument("cash_payments", p._id);
      if (p.partyId) await recalculatePartyBalance(String(p.partyId));
    }

    const allReceipts = await getDocuments("cash_receipts");
    const oldReceipts = allReceipts.filter((r: any) => r.receiptNumber === voucherNo);
    for (const r of oldReceipts) {
      await deleteDocument("cash_receipts", r._id);
      if (r.partyId) await recalculatePartyBalance(String(r.partyId));
    }

    return ok({ message: "Deleted successfully" });
  } catch (e) {
    return fail((e as Error).message);
  }
}

export const dynamic = "force-dynamic";
