import { fail, ok } from "@/lib/api";
import { getDocuments, getDocumentById, createDocument } from "@/lib/firestore/genericRepository";
import { recalculatePartyBalance, postCashPaymentJournalEntries } from "@/services/posting/invoicePostingHelper";

export async function GET() {
  try {
    const rows = await getDocuments("cash_payments");
    const parties = await getDocuments("parties");
    const accounts = await getDocuments("accounts");
    const jobs = await getDocuments("jobs");

    const partyMap = new Map(parties.map((p: any) => [String(p._id), p]));
    const accountMap = new Map(accounts.map((a: any) => [String(a._id), a]));
    const jobMap = new Map(jobs.map((j: any) => [String(j._id), j]));

    const populatedRows = rows.map((r: any) => ({
      ...r,
      partyId: r.partyId ? partyMap.get(String(r.partyId)) || r.partyId : null,
      cashAccountId: r.cashAccountId ? accountMap.get(String(r.cashAccountId)) || r.cashAccountId : null,
      jobId: r.jobId ? jobMap.get(String(r.jobId)) || r.jobId : null,
    }));

    populatedRows.sort((a: any, b: any) => new Date(b.createdAt || b.date || 0).getTime() - new Date(a.createdAt || a.date || 0).getTime());

    return ok(populatedRows);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body.voucherNo || body.voucherNo === "Auto-generated") {
      const existing = await getDocuments("cash_payments");
      let attempt = existing.length + 1;
      let isUnique = false;
      while (!isUnique) {
        const candidate = `CPV-${attempt.toString().padStart(5, "0")}`;
        const match = existing.find((e: any) => e.voucherNo === candidate);
        if (!match) {
          body.voucherNo = candidate;
          isUnique = true;
        } else attempt++;
      }
    }

    const paymentType = body.paymentType === "petty" ? "petty" : "party";
    let amount = Number(body.amount ?? body.totalAmount) || 0;
    const whtRate = Number(body.whtRate) || 0;
    let whtAmount = Number(body.whtAmount) || 0;

    if (paymentType === "petty" && Array.isArray(body.contraLines) && body.contraLines.length) {
      amount = body.contraLines.reduce((s: number, l: { amount?: number }) => s + (Number(l.amount) || 0), 0);
      whtAmount = (amount * whtRate) / 100;
    }

    const netPaid = amount - whtAmount;
    const partyId = body.partyId || body.vendorId || null;

    const payload = {
      voucherNo: body.voucherNo,
      paymentType,
      date: body.date,
      partyId: partyId || null,
      vendor: partyId ? String(partyId) : "",
      cashAccountId: body.cashAccountId || null,
      cashAccountTitle: body.cashAccountTitle || "",
      reference: body.reference || "",
      narration: body.narration || body.internalNotes || "",
      jobId: body.jobId || null,
      amount,
      whtRate,
      whtAmount,
      netPaid,
      notes: body.notes || body.internalNotes || "",
      status: body.status || "Posted",
      mode: paymentType === "petty" ? "Petty" : "Party",
      partyPaymentType: body.partyPaymentType || "",
      isRefund: !!body.isRefund,
      contraLines: body.contraLines || [],
    };

    const row = await createDocument("cash_payments", payload);

    if (row.status === "Posted") {
      await postCashPaymentJournalEntries(row);
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
