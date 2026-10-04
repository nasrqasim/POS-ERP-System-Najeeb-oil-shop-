import { ok } from "@/lib/api";
import { getDocuments } from "@/lib/firestore/genericRepository";

export async function GET() {
  try {
    const entries = await getDocuments("journal_entries");
    const filtered = entries.filter((j: any) => ["1000", "1010", "1111"].includes(j.accountCode));
    filtered.sort((a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
    return ok(filtered.slice(0, 200));
  } catch (e) {
    return ok([]);
  }
}

export const dynamic = "force-dynamic";
