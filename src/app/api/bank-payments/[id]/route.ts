import { fail, ok } from "@/lib/api";
import { getDocumentById, updateDocument, deleteDocument } from "@/lib/firestore/genericRepository";
import { recalculatePartyBalance, postBankPaymentJournalEntries, deleteJournalEntriesByVoucherNo } from "@/services/posting/invoicePostingHelper";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const oldDoc = await getDocumentById("bank_payments", params.id);
    const row = await updateDocument("bank_payments", params.id, body);
    if (!row) return fail("Not found", 404);

    if (row.status === "Posted" || row.status === "posted") {
      await postBankPaymentJournalEntries(row);
    } else {
      await deleteJournalEntriesByVoucherNo(row.voucherNo);
    }

    const oldVendorId = oldDoc?.vendor || oldDoc?.partyId;
    const newVendorId = row.vendor || row.partyId;
    if (oldVendorId) await recalculatePartyBalance(String(oldVendorId));
    if (newVendorId && String(newVendorId) !== String(oldVendorId)) {
      await recalculatePartyBalance(String(newVendorId));
    }
    return ok(row);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const oldDoc = await getDocumentById("bank_payments", params.id);
    if (oldDoc) {
      await deleteJournalEntriesByVoucherNo(oldDoc.voucherNo);
      await deleteDocument("bank_payments", params.id);
      const vendorId = oldDoc.vendor || oldDoc.partyId;
      if (vendorId) await recalculatePartyBalance(String(vendorId));
    }
    return ok({ deleted: true });
  } catch (e) {
    return fail((e as Error).message);
  }
}
