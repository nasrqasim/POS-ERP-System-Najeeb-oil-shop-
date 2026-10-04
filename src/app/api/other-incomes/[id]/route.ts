import { fail, ok } from "@/lib/api";
import { getDocumentById, updateDocument, deleteDocument, createDocument } from "@/lib/firestore/genericRepository";
import { deleteJournalEntriesByVoucherNo } from "@/services/posting/invoicePostingHelper";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const row = await getDocumentById("other_incomes", params.id);
    if (!row) {
      return fail("Record not found", 404);
    }
    return ok(row);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const row = await updateDocument("other_incomes", params.id, body);
    if (!row) {
      return fail("Record not found", 404);
    }

    const voucherNo = `INC-${row._id}`;
    await deleteJournalEntriesByVoucherNo(voucherNo);

    const isCash = row.paymentMethod === "Cash";
    const assetCode = isCash ? "1111" : "1110";
    const assetTitle = isCash ? "Cash" : "Bank";

    await createDocument("journal_entries", {
      date: row.date,
      voucherNo,
      accountCode: assetCode,
      accountTitle: assetTitle,
      debit: Number(row.amount) || 0,
      credit: 0,
      remarks: row.description || row.title
    });

    await createDocument("journal_entries", {
      date: row.date,
      voucherNo,
      accountCode: "40002001",
      accountTitle: "Other Income",
      debit: 0,
      credit: Number(row.amount) || 0,
      remarks: row.description || row.title
    });

    return ok(row);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const row = await getDocumentById("other_incomes", params.id);
    if (!row) {
      return fail("Record not found", 404);
    }

    await deleteDocument("other_incomes", params.id);
    const voucherNo = `INC-${row._id}`;
    await deleteJournalEntriesByVoucherNo(voucherNo);

    return ok({ message: "Record deleted successfully" });
  } catch (e) {
    return fail((e as Error).message);
  }
}
