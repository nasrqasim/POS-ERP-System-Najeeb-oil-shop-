import { fail, ok } from "@/lib/api";
import { getDocuments, createDocument, updateDocument, deleteDocument } from "@/lib/firestore/genericRepository";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");

    let rows = await getDocuments("opening_balances");
    if (type) {
      rows = rows.filter((r: any) => r.type === type);
    }
    rows.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    if (rows.length === 0) {
      if (type === "Item") {
        const items = await getDocuments("items");
        return ok(items.map((i: any) => ({
          type: "Item",
          itemId: i._id,
          itemName: i.name,
          unit: i.unit || "Ctn",
          qty: i.stockQtyCartons || 0,
          rate: i.purchaseRate || 0
        })));
      }
      if (type === "Account") {
        const accounts = await getDocuments("accounts");
        return ok(accounts.map((a: any) => ({
          type: "Account",
          accountId: a._id,
          accountName: a.title,
          balanceType: "Debit",
          amount: a.openingBalance || 0
        })));
      }
    }

    return ok(rows);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (Array.isArray(body)) {
      const allBal = await getDocuments("opening_balances");
      for (const entry of body) {
        const existing = allBal.find((b: any) => 
          b.type === entry.type && 
          (entry.itemId ? String(b.itemId) === String(entry.itemId) : String(b.accountId) === String(entry.accountId))
        );

        if (existing) {
          await updateDocument("opening_balances", existing._id, { ...entry, posted: true });
        } else {
          await createDocument("opening_balances", { ...entry, posted: true });
        }

        if (entry.type === "Item" && entry.itemId) {
          await updateDocument("items", String(entry.itemId), {
            stockQtyCartons: entry.qty,
            purchaseRate: entry.rate
          });
        } else if (entry.type === "Account" && entry.accountId) {
          await updateDocument("accounts", String(entry.accountId), {
            openingBalance: entry.amount
          });
        }
      }
      return ok({ message: "Balances posted and synced successfully" });
    }

    const row = await createDocument("opening_balances", body);
    return ok(row, 201);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const allBal = await getDocuments("opening_balances");
    const toDelete = type ? allBal.filter((b: any) => b.type === type) : allBal;
    for (const d of toDelete) {
      await deleteDocument("opening_balances", d._id);
    }
    return ok({ deleted: true });
  } catch (e) {
    return fail((e as Error).message);
  }
}

export const dynamic = "force-dynamic";
