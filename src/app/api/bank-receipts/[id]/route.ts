import { fail, ok } from "@/lib/api";
import { getDocumentById, updateDocument, deleteDocument } from "@/lib/firestore/genericRepository";
import { recalculatePartyBalance, postBankReceiptJournalEntries, deleteJournalEntriesByVoucherNo } from "@/services/posting/invoicePostingHelper";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const oldDoc = await getDocumentById("bank_receipts", params.id);
    const row = await updateDocument("bank_receipts", params.id, body);
    if (!row) return fail("Not found", 404);

    if (row.status === "Posted" || row.status === "posted") {
      await postBankReceiptJournalEntries(row);
    } else {
      await deleteJournalEntriesByVoucherNo(row.receiptNumber || row.voucherNo);
    }

    const oldPartyId = oldDoc?.party || oldDoc?.partyId;
    const newPartyId = row.party || row.partyId;
    if (oldPartyId) await recalculatePartyBalance(String(oldPartyId));
    if (newPartyId && String(newPartyId) !== String(oldPartyId)) {
      await recalculatePartyBalance(String(newPartyId));
    }
    return ok(row);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const oldDoc = await getDocumentById("bank_receipts", params.id);
    if (oldDoc) {
      await deleteJournalEntriesByVoucherNo(oldDoc.receiptNumber || oldDoc.voucherNo);
      await deleteDocument("bank_receipts", params.id);
      const partyId = oldDoc.party || oldDoc.partyId;
      if (partyId) await recalculatePartyBalance(String(partyId));
    }
    return ok({ deleted: true });
  } catch (e) {
    return fail((e as Error).message);
  }
}
