import { fail, ok } from "@/lib/api";
import { getDocuments, createDocument } from "@/lib/firestore/genericRepository";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = (searchParams.get("search") || "").toLowerCase().trim();
    const incomeType = searchParams.get("incomeType");
    const paymentMethod = searchParams.get("paymentMethod");
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");

    let rows = await getDocuments("other_incomes");

    if (search) {
      rows = rows.filter((r: any) =>
        String(r.title || "").toLowerCase().includes(search) ||
        String(r.description || "").toLowerCase().includes(search)
      );
    }

    if (incomeType) {
      rows = rows.filter((r: any) => r.incomeType === incomeType);
    }

    if (paymentMethod) {
      rows = rows.filter((r: any) => r.paymentMethod === paymentMethod);
    }

    if (fromDate || toDate) {
      const fromTime = fromDate ? new Date(fromDate).getTime() : 0;
      const toTime = toDate ? new Date(toDate).getTime() : Infinity;
      rows = rows.filter((r: any) => {
        const t = new Date(r.date || 0).getTime();
        return t >= fromTime && t <= toTime;
      });
    }

    rows.sort((a: any, b: any) => new Date(b.date || b.createdAt || 0).getTime() - new Date(a.date || a.createdAt || 0).getTime());

    return ok(rows);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const row = await createDocument("other_incomes", body);

    const voucherNo = `INC-${row._id}`;
    const isCash = row.paymentMethod === "Cash";
    const assetCode = isCash ? "1111" : "1110";
    const assetTitle = isCash ? "Cash" : "Bank";

    await createDocument("journal_entries", {
      date: row.date,
      voucherNo,
      accountCode: assetCode,
      accountTitle: assetTitle,
      debit: Number(row.amount) || 0,
      credit: 0,
      remarks: row.description || row.title
    });

    await createDocument("journal_entries", {
      date: row.date,
      voucherNo,
      accountCode: "40002001",
      accountTitle: "Other Income",
      debit: 0,
      credit: Number(row.amount) || 0,
      remarks: row.description || row.title
    });

    return ok(row, 201);
  } catch (e) {
    return fail((e as Error).message);
  }
}
