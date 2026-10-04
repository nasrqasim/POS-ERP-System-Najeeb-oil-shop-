import { fail, ok } from "@/lib/api";
import { getDocuments, createDocument, getDocumentById } from "@/lib/firestore/genericRepository";
import { postBankPayment } from "@/services/posting/transactionPosting";
import { recalculatePartyBalance } from "@/services/posting/invoicePostingHelper";

export async function GET() {
  try {
    const bankPayments = await getDocuments("bank_payments");
    const parties = await getDocuments("parties");
    const banks = await getDocuments("banks");

    const partyMap = new Map(parties.map((p: any) => [String(p._id), p.name || p.companyName]));
    const bankMap = new Map(banks.map((b: any) => [String(b._id), b.name || b.bankName || b.title]));

    const rows = bankPayments.map((bp: any) => {
      const vendorId = String(bp.vendor || bp.partyId || "");
      const bankId = String(bp.bankAccount || bp.bankAccountId || "");
      return {
        ...bp,
        vendor: partyMap.get(vendorId) || bp.vendor || vendorId,
        bankAccount: bankMap.get(bankId) || bp.bankAccount || bankId,
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
      const existing = await getDocuments("bank_payments");
      let attempt = existing.length + 1;
      let isUnique = false;
      while (!isUnique) {
        const candidate = `BPV-${attempt.toString().padStart(5, "0")}`;
        const match = existing.find((e: any) => e.voucherNo === candidate);
        if (!match) {
          body.voucherNo = candidate;
          isUnique = true;
        } else {
          attempt++;
        }
      }
    }

    const row = await postBankPayment({
      voucherNo: body.voucherNo,
      date: body.date,
      partyId: body.vendorId || body.partyId,
      bankId: body.bankAccountId || body.bankAccount,
      amount: Number(body.totalAmount || body.amount || 0),
      wht: Number(body.whtAmount || body.wht || 0),
      netAmount: Number(body.totalAmount || body.amount || 0) - Number(body.whtAmount || body.wht || 0),
      narration: body.narration,
      partyPaymentType: body.partyPaymentType,
      isRefund: body.isRefund,
    });

    const vendorId = body.vendorId || body.partyId;
    if (vendorId) await recalculatePartyBalance(String(vendorId));

    return ok(row, 201);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export const dynamic = "force-dynamic";
