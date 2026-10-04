import { fail, ok } from "@/lib/api";
import { getAllCashReceipts, createCashReceipt } from "@/lib/firestore/paymentsRepository";
import { recalculatePartyBalance, postCashReceiptJournalEntries } from "@/services/posting/invoicePostingHelper";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const search = url.searchParams.get("search") || "";

    let rows = await getAllCashReceipts();

    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((r: any) => {
        const num = r.receiptNumber || "";
        const ref = r.reference || "";
        const narr = r.narration || "";
        const amt = String(r.amount || "");
        const rType = r.receiptType || "";
        const partyName = r.party || r.partyName || "";
        
        return num.toLowerCase().includes(q) ||
               ref.toLowerCase().includes(q) ||
               narr.toLowerCase().includes(q) ||
               amt.includes(q) ||
               rType.toLowerCase().includes(q) ||
               partyName.toLowerCase().includes(q);
      });
    }

    return ok(rows);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body.receiptNumber || body.receiptNumber === "Auto-generated") {
      const all = await getAllCashReceipts();
      let attempt = all.length + 1;
      let candidate = `CRV-${attempt.toString().padStart(5, "0")}`;
      body.receiptNumber = candidate;
    }

    if (body.receiptType === "multi" && Array.isArray(body.partyLines)) {
      body.amount = body.partyLines.reduce((s: number, l: any) => s + (Number(l.amount) || 0), 0);
      body.netAmount = body.amount;
    }
    if (body.receiptType === "petty" && Array.isArray(body.contraLines)) {
      body.amount = body.contraLines.reduce((s: number, l: any) => s + (Number(l.amount) || 0), 0);
      body.netAmount = body.amount;
    }

    const payload = {
      ...body,
      partyReceiptType: body.partyReceiptType || "Standard"
    };

    const row = await createCashReceipt(payload);
    const partyId = row.partyId?.toString?.() || row.partyId;
    if (row.status === "Posted" || !row.status) {
      await postCashReceiptJournalEntries(row);
      if (partyId) {
        await recalculatePartyBalance(String(partyId));
      }
    }
    return ok(row, 201);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export const dynamic = "force-dynamic";
