import { fail, ok } from "@/lib/api";
import { getDocumentById, updateDocument, deleteDocument } from "@/lib/firestore/genericRepository";
import { generateInvoiceJournalEntries, recalculatePartyBalance, deleteJournalEntriesByInvoiceId } from "@/services/posting/invoicePostingHelper";
import { normalizeInvoicePayload } from "@/lib/invoicePayload";
import { getPopulatedInvoice } from "@/lib/invoiceQueries";

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const role = session?.user?.role;
    const normalizedRole = (role || "").toLowerCase().replace(/\s+/g, "");

    const row = await getPopulatedInvoice(params.id);
    if (!row) return fail("Invoice not found", 404);

    if (normalizedRole === "sales_user" || normalizedRole === "salesuser") {
      if ((row as any).type !== "sale" && (row as any).type !== "sale_return" && (row as any).type !== "pos") {
        return fail("Permission denied", 403);
      }
    }

    return ok(row);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const role = session?.user?.role;
    const normalizedRole = (role || "").toLowerCase().replace(/\s+/g, "");

    if (normalizedRole === "sales_user" || normalizedRole === "salesuser") {
      const existing = await getDocumentById("invoices", params.id);
      if (!existing || ((existing as any).type !== "sale" && (existing as any).type !== "sale_return" && (existing as any).type !== "pos")) {
        return fail("Permission denied", 403);
      }
    }

    const body = await req.json();
    const payload = normalizeInvoicePayload(body);

    if (normalizedRole === "sales_user" || normalizedRole === "salesuser") {
      if (payload.type && payload.type !== "sale" && payload.type !== "sale_return" && payload.type !== "pos") {
        return fail("Permission denied (Restricted invoice type)", 403);
      }
    }

    if (payload.partyId) {
      const party = await getDocumentById("parties", String(payload.partyId));
      if (party && (party.name || party.companyName || "").toLowerCase().includes("walk-in")) {
        payload.amountReceived = payload.totalAmount;
        payload.balance = 0;
      }
    }

    const row = await updateDocument("invoices", params.id, payload);

    if (row) {
      try {
        await generateInvoiceJournalEntries(row);
      } catch (journalErr) {
        console.warn("Journal entry update skipped or non-fatal error:", journalErr);
      }
    }

    const populated = row ? await getPopulatedInvoice(params.id) : null;
    return ok(populated ?? row);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const role = session?.user?.role;
    const normalizedRole = (role || "").toLowerCase().replace(/\s+/g, "");

    if (normalizedRole === "sales_user" || normalizedRole === "salesuser") {
      const existing = await getDocumentById("invoices", params.id);
      if (!existing || ((existing as any).type !== "sale" && (existing as any).type !== "sale_return" && (existing as any).type !== "pos")) {
        return fail("Permission denied", 403);
      }
    }
    
    const invoice = await getDocumentById("invoices", params.id);
    const partyId = invoice?.partyId;

    await deleteDocument("invoices", params.id);
    await deleteJournalEntriesByInvoiceId(params.id);
    
    if (partyId) {
      await recalculatePartyBalance(String(partyId));
    }

    return ok({ deleted: true });
  } catch (e) {
    return fail((e as Error).message);
  }
}

export const dynamic = "force-dynamic";
