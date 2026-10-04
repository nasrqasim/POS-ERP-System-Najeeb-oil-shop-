import { fail, ok } from "@/lib/api";
import { getAllJournalEntries, createJournalEntry } from "@/lib/firestore/journalRepository";
import { createCashPayment, createCashReceipt } from "@/lib/firestore/paymentsRepository";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const partyId = searchParams.get("partyId");

  try {
    const rows = await getAllJournalEntries(partyId || undefined);
    return ok(rows);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    let created;
    if (body.entries && Array.isArray(body.entries)) {
      created = await Promise.all(body.entries.map((entry: any) => createJournalEntry(entry)));
    } else {
      created = await createJournalEntry(body);
    }

    const partyId = body.partyId;
    const partyType = body.partyType;

    if (partyId && partyType) {
      const amount = Number(body.amount) || 0;
      const date = body.date || new Date().toISOString().split("T")[0];
      const remarks = body.remarks || "";
      const voucherNo = body.voucherNo || `JV-${Date.now()}`;

      if (partyType === "vendor") {
        await createCashPayment({
          voucherNo,
          paymentType: "party",
          date,
          partyId,
          vendor: String(partyId),
          amount,
          narration: remarks,
          status: "Posted",
        });
      } else if (partyType === "customer") {
        await createCashReceipt({
          receiptNumber: voucherNo,
          receiptType: "party",
          date,
          partyId,
          amount,
          narration: remarks,
          status: "Posted",
        });
      }
    }

    return ok(created, 201);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export const dynamic = "force-dynamic";
