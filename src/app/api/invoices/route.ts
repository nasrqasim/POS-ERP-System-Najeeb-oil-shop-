import { fail, ok } from "@/lib/api";
import { getAllInvoices, createInvoice } from "@/lib/firestore/invoicesRepository";
import { generateInvoiceJournalEntries, recalculatePartyBalance } from "@/services/posting/invoicePostingHelper";
import { normalizeInvoicePayload } from "@/lib/invoicePayload";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const partyId = searchParams.get("partyId");

    let rows = await getAllInvoices(type || undefined);
    if (partyId) {
      rows = rows.filter((r: any) => String(r.partyId?._id || r.partyId) === String(partyId));
    }
    return ok(rows);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const role = session?.user?.role;
    const normalizedRole = (role || "").toLowerCase().replace(/\s+/g, "");

    const body = await req.json();
    const payload = normalizeInvoicePayload(body);

    if (normalizedRole === "sales_user" || normalizedRole === "salesuser") {
      if (payload.type !== "sale" && payload.type !== "sale_return" && payload.type !== "pos") {
        return fail("Permission denied (Restricted invoice type)", 403);
      }
    }

    const row = await createInvoice(payload);
    try {
      await generateInvoiceJournalEntries(row);
    } catch (journalErr) {
      console.warn("Journal entry creation skipped or non-fatal error:", journalErr);
    }

    if (row.partyId) {
      try {
        await recalculatePartyBalance(row.partyId);
      } catch (balErr) {
        console.warn("recalculatePartyBalance error:", balErr);
      }
    }

    return ok(row, 201);
  } catch (e) {
    return fail((e as Error).message);
  }
}
