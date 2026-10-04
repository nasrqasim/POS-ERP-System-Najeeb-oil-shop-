import { fail, ok } from "@/lib/api";
import { getDocuments, createDocument } from "@/lib/firestore/genericRepository";
import { postBankReceipt } from "@/services/posting/transactionPosting";
import { recalculatePartyBalance } from "@/services/posting/invoicePostingHelper";

export async function GET() {
  try {
    const bankReceipts = await getDocuments("bank_receipts");
    const parties = await getDocuments("parties");
    const banks = await getDocuments("banks");

    const partyMap = new Map(parties.map((p: any) => [String(p._id), p.name || p.companyName]));
    const bankMap = new Map(banks.map((b: any) => [String(b._id), b.name || b.bankName || b.title]));

    const rows = bankReceipts.map((br: any) => {
      const partyId = String(br.party || br.partyId || "");
      const bankId = String(br.bankAccount || br.bankAccountId || "");
      return {
        ...br,
        party: partyMap.get(partyId) || br.party || partyId,
        bankAccount: bankMap.get(bankId) || br.bankAccount || bankId,
      };
    });

    rows.sort((a: any, b: any) => new Date(b.createdAt || b.date || 0).getTime() - new Date(a.createdAt || a.date || 0).getTime());

    return ok(rows);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body.voucherNo || body.voucherNo === "Auto-generated") {
      const existing = await getDocuments("bank_receipts");
      let attempt = existing.length + 1;
      let isUnique = false;
      while (!isUnique) {
        const candidate = `BRV-${attempt.toString().padStart(5, "0")}`;
        const match = existing.find((e: any) => e.receiptNumber === candidate || e.voucherNo === candidate);
        if (!match) {
          body.voucherNo = candidate;
          isUnique = true;
        } else {
          attempt++;
        }
      }
    }

    const row = await postBankReceipt({
      voucherNo: body.voucherNo,
      date: body.date,
      partyId: body.customerId || body.partyId,
      bankId: body.bankAccountId || body.bankAccount,
      amount: Number(body.totalAmount || body.amount || 0),
      netAmount: Number(body.totalAmount || body.amount || 0),
      narration: body.narration,
    });

    const partyId = body.customerId || body.partyId;
    if (partyId) await recalculatePartyBalance(String(partyId));

    return ok(row, 201);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export const dynamic = "force-dynamic";
