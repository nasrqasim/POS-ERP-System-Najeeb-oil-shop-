import { fail, ok } from "@/lib/api";
import { getDocuments, createDocument, updateDocument } from "@/lib/firestore/genericRepository";

export async function GET() {
  try {
    const list = await getDocuments("shop_profiles");
    return ok(list[0] || null);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const list = await getDocuments("shop_profiles");
    let profile;
    if (list.length === 0) {
      profile = await createDocument("shop_profiles", body);
    } else {
      profile = await updateDocument("shop_profiles", list[0]._id, body);
    }
    return ok(profile);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export const dynamic = "force-dynamic";
