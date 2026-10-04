import { fail, ok } from "@/lib/api";
import { getDocuments, createDocument, updateDocument } from "@/lib/firestore/genericRepository";

export async function GET() {
  try {
    const list = await getDocuments("inventory_settings");
    let setting = list[0];
    if (!setting) {
      setting = await createDocument("inventory_settings", {});
    }
    return ok(setting);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const list = await getDocuments("inventory_settings");
    let updatedSetting;
    if (list.length > 0) {
      updatedSetting = await updateDocument("inventory_settings", list[0]._id, body);
    } else {
      updatedSetting = await createDocument("inventory_settings", body);
    }

    return ok(updatedSetting);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export const dynamic = "force-dynamic";
