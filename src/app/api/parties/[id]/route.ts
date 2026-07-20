import { fail, ok } from "@/lib/api";
import dbConnect from "@/lib/db";
import Party from "@/models/Party";
import { recalculatePartyBalance, getCustomerAdvanceStats, adjustManualBalancesForClosing } from "@/services/posting/invoicePostingHelper";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    const role = session?.user?.role;
    const normalizedRole = (role || "").toLowerCase().replace(/\s+/g, "");

    const url = new URL(req.url);
    const refresh = url.searchParams.get("refresh") === "1";

    if (refresh) {
      await recalculatePartyBalance(params.id);
    }

    const row = await Party.findById(params.id).lean();
    if (!row) return fail("Party not found", 404);

    if (normalizedRole === "sales_user" || normalizedRole === "salesuser") {
      if ((row as any).type !== "Customer") {
        return fail("Permission denied", 403);
      }
    }

    // Calculate advance stats for customers
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

    await dbConnect();

    if (normalizedRole === "sales_user" || normalizedRole === "salesuser") {
      const existing = await Party.findById(params.id).lean();
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
    const row = await Party.findByIdAndUpdate(params.id, adjustedBody, { new: true });
    if (!row) return fail("Party not found", 404);
    
    // Automatically recalculate the balance using the updated openingBalance
    await recalculatePartyBalance(params.id);
    
    // Fetch the updated row to return it
    const updatedRow = await Party.findById(params.id).lean();
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

    await dbConnect();

    if (normalizedRole === "sales_user" || normalizedRole === "salesuser") {
      const existing = await Party.findById(params.id).lean();
      if (!existing || (existing as any).type !== "Customer") {
        return fail("Permission denied", 403);
      }
    }

    const row = await Party.findByIdAndDelete(params.id);
    if (!row) return fail("Party not found", 404);
    return ok({ deleted: true });
  } catch (e) {
    return fail((e as Error).message);
  }
}

export const dynamic = "force-dynamic";
