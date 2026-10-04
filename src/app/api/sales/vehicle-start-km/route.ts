import { fail, ok } from "@/lib/api";
import { getDocuments } from "@/lib/firestore/genericRepository";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const regNo = searchParams.get("regNo");
  if (!regNo) return fail("regNo is required");

  const logs = await getDocuments("vehicle_logs");
  const filtered = logs.filter((l: any) => String(l.regNo).toLowerCase() === String(regNo).toLowerCase());

  filtered.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  const last = filtered[0];

  return ok({ startKms: last?.endKms ?? 0, lastInvoiceId: last?.invoiceId ?? null });
}

export const dynamic = "force-dynamic";
