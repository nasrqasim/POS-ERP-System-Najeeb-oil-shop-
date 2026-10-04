import { fail, ok } from "@/lib/api";
import { getDocuments } from "@/lib/firestore/genericRepository";
import { calculateCustomerBalance, calculateVendorBalance } from "@/lib/centralizedBalanceService";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const partyId = searchParams.get("partyId");
    if (!partyId) return fail("partyId is required", 400);

    const [
      parties,
      allInvoices,
      cashReceipts,
      bankReceipts,
      cashPayments,
      bankPayments
    ] = await Promise.all([
      getDocuments("parties"),
      getDocuments("invoices"),
      getDocuments("cash_receipts"),
      getDocuments("bank_receipts"),
      getDocuments("cash_payments"),
      getDocuments("bank_payments")
    ]);

    const party = parties.find((p: any) => String(p._id || p.id) === String(partyId));
    if (!party) return fail("Party not found", 404);

    let data;
    if (party.type === "Customer" || party.type === "customer") {
      data = calculateCustomerBalance(
        party,
        allInvoices,
        cashReceipts,
        bankReceipts,
        cashPayments,
        bankPayments
      );
    } else {
      data = calculateVendorBalance(
        party,
        allInvoices,
        cashReceipts,
        bankReceipts,
        cashPayments,
        bankPayments
      );
    }

    return ok({
      party: {
        _id: party._id || party.id,
        name: party.companyName || party.name,
        type: party.type
      },
      ...data
    });
  } catch (error: any) {
    console.error("Party Ledger Error:", error);
    return fail(error.message, 500);
  }
}

export const dynamic = "force-dynamic";
