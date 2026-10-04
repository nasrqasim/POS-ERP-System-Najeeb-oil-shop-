import { fail, ok } from "@/lib/api";
import { getPartyById, updateParty, deleteParty } from "@/lib/firestore/partiesRepository";
import { getCustomerAdvanceStats, adjustManualBalancesForClosing } from "@/services/posting/invoicePostingHelper";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const role = session?.user?.role;
    const normalizedRole = (role || "").toLowerCase().replace(/\s+/g, "");

    const row = await getPartyById(params.id);
    if (!row) return fail("Party not found", 404);

    if (normalizedRole === "sales_user" || normalizedRole === "salesuser") {
      if ((row as any).type !== "Customer") {
        return fail("Permission denied", 403);
      }
    }

    let advanceStats = null;
    if ((row as any).type === "Customer") {
      advanceStats = await getCustomerAdvanceStats(params.id);
    }

    return ok({ ...(row as any), advanceStats });
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
      const existing = await getPartyById(params.id);
      if (!existing || (existing as any).type !== "Customer") {
        return fail("Permission denied", 403);
      }
    }

    const body = await req.json();

    if (normalizedRole === "sales_user" || normalizedRole === "salesuser") {
      if (body.type && body.type !== "Customer") {
        return fail("Permission denied (Restricted party type)", 403);
      }
    }

    const adjustedBody = await adjustManualBalancesForClosing(params.id, body);
    const updatedRow = await updateParty(params.id, adjustedBody);
    return ok(updatedRow);
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
      const existing = await getPartyById(params.id);
      if (!existing || (existing as any).type !== "Customer") {
        return fail("Permission denied", 403);
      }
    }

    await deleteParty(params.id);
    return ok({ deleted: true });
  } catch (e) {
    return fail((e as Error).message);
  }
}

export const dynamic = "force-dynamic";
