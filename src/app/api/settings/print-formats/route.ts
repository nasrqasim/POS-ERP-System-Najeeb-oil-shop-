import { fail, ok } from "@/lib/api";
import { getDocuments, createDocument, updateDocument } from "@/lib/firestore/genericRepository";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const formatName = searchParams.get("formatName");

    const allFormats = await getDocuments("print_formats");
    
    if (formatName) {
      let format = allFormats.find((f: any) => f.formatName === formatName);
      if (!format) {
        format = await createDocument("print_formats", { formatName });
      }
      return ok(format);
    }

    return ok(allFormats);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { formatName, ...config } = body;

    if (!formatName) return fail("Format name is required");

    const allFormats = await getDocuments("print_formats");
    const existing = allFormats.find((f: any) => f.formatName === formatName);

    let updatedFormat;
    if (existing) {
      updatedFormat = await updateDocument("print_formats", existing._id, { ...config });
    } else {
      updatedFormat = await createDocument("print_formats", { formatName, ...config });
    }

    return ok(updatedFormat);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export const dynamic = "force-dynamic";
