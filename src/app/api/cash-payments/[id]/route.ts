import { fail, ok } from "@/lib/api";
import { getDocumentById, updateDocument, deleteDocument } from "@/lib/firestore/genericRepository";
import { recalculatePartyBalance, postCashPaymentJournalEntries, deleteJournalEntriesByVoucherNo } from "@/services/posting/invoicePostingHelper";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();

    const amount = Number(body.amount ?? body.totalAmount) || 0;
    const whtAmount = Number(body.whtAmount) || 0;
    const partyId = body.partyId || body.vendorId || null;

    const payload = {
      ...body,
      partyId,
      vendor: partyId ? String(partyId) : "",
      amount,
      whtAmount,
      netPaid: amount - whtAmount,
    };

    const row = await updateDocument("cash_payments", params.id, payload);
    if (!row) return fail("Not found", 404);

    if (row.status === "Posted") {
      await postCashPaymentJournalEntries(row);
    } else {
      await deleteJournalEntriesByVoucherNo(row.voucherNo);
    }

    if (partyId) await recalculatePartyBalance(String(partyId));

    return ok(row);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const row = await getDocumentById("cash_payments", params.id);
    if (row) {
      const partyId = row.partyId ? String(row.partyId) : row.vendor;
      await deleteJournalEntriesByVoucherNo(row.voucherNo);
      await deleteDocument("cash_payments", params.id);
      if (partyId) await recalculatePartyBalance(partyId);
    }
    return ok({ deleted: true });
  } catch (e) {
    return fail((e as Error).message);
  }
}

export const dynamic = "force-dynamic";
