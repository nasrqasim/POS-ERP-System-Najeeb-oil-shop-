import { fail, ok } from "@/lib/api";
import dbConnect from "@/lib/db";
import Party from "@/models/Party";
import { recalculatePartyBalance, getCustomerAdvanceStats, adjustManualBalancesForClosing } from "@/services/posting/invoicePostingHelper";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  const normalizedRole = (role || "").toLowerCase().replace(/\s+/g, "");

  const { searchParams } = new URL(req.url);
  const typeParam = searchParams.get("type");

  const query: any = {};
  if (normalizedRole === "sales_user" || normalizedRole === "salesuser") {
    query.type = "Customer";
  } else if (typeParam === "customer") {
    query.type = "Customer";
  } else if (typeParam === "vendor") {
    query.type = "Vendor";
  }

  await dbConnect();
  const rows = await Party.find(query).sort({ createdAt: -1 }).lean();
  
  const rowsWithStats = await Promise.all(rows.map(async (r: any) => {
    if (r.type === "Customer") {
      try {
        const stats = await getCustomerAdvanceStats(r._id.toString());
        return { ...r, advanceStats: stats };
      } catch (err) {
        return r;
      }
    }
    return r;
  }));

  return ok(rowsWithStats);
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const role = session?.user?.role;
    const normalizedRole = (role || "").toLowerCase().replace(/\s+/g, "");

    const body = await req.json();

    if (normalizedRole === "sales_user" || normalizedRole === "salesuser") {
      if (body.type !== "Customer") {
        return fail("Permission denied (Restricted party type)", 403);
      }
    }

    await dbConnect();
    const adjustedBody = await adjustManualBalancesForClosing(null, body);
    if (adjustedBody.openingBalance && (!adjustedBody.balance || adjustedBody.balance === 0)) {
      adjustedBody.balance = adjustedBody.openingBalance;
    }
    const row = await Party.create(adjustedBody);
    await recalculatePartyBalance(String(row._id));
    const finalRow = await Party.findById(row._id).lean();
    return ok(finalRow || row, 201);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export const dynamic = "force-dynamic";
