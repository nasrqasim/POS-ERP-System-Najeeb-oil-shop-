import { fail, ok } from "@/lib/api";
import { getDocuments, createDocument, updateDocument } from "@/lib/firestore/genericRepository";

export async function GET() {
  try {
    const years = await getDocuments("financial_years");
    years.sort((a: any, b: any) => new Date(b.startDate || 0).getTime() - new Date(a.startDate || 0).getTime());
    return ok(years);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, startDate, endDate, status } = body;

    if (!name || !startDate || !endDate) {
      return fail("Missing required fields");
    }

    if (status === "Current") {
      const existingYears = await getDocuments("financial_years");
      for (const y of existingYears) {
        if (y.status === "Current") {
          await updateDocument("financial_years", y._id, { status: "Closed", isClosed: true });
        }
      }
    }

    const newYear = await createDocument("financial_years", {
      name,
      startDate,
      endDate,
      status: status || "Upcoming",
      isClosed: status === "Closed"
    });

    return ok(newYear);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export const dynamic = "force-dynamic";
