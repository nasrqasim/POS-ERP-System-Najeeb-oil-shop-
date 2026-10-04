import { adminDb } from "@/lib/firestore/admin";
import { NextResponse } from "next/server";
import { GET as getDashboard } from "@/app/api/dashboard/route";

export async function GET(req: Request) {
  try {
    const collections = await adminDb.listCollections();
    const collectionNames = collections.map(c => c.id);

    const invoicesSnap = await adminDb.collection("invoices").get();
    const invoices = invoicesSnap.docs.map(d => ({
      id: d.id,
      invoiceNo: d.data().invoiceNo,
      type: d.data().type,
      date: d.data().date,
      createdAt: d.data().createdAt,
      totalAmount: d.data().totalAmount,
      status: d.data().status,
      paymentMethod: d.data().paymentMethod,
      partyId: d.data().partyId
    }));

    const itemsSnap = await adminDb.collection("items").get();
    const partiesSnap = await adminDb.collection("parties").get();
    const jvSnap = await adminDb.collection("journalentries").get();

    let dashboardData: any = null;
    let dashboardError: any = null;
    try {
      const url = new URL(req.url);
      const dateParam = url.searchParams.get("date") || "";
      const dashUrl = dateParam ? `http://localhost/api/dashboard?date=${dateParam}` : "http://localhost/api/dashboard";
      const dbRes = await getDashboard(new Request(dashUrl));
      dashboardData = await dbRes.json();
    } catch (e: any) {
      dashboardError = { message: e?.message, stack: e?.stack };
    }

    return NextResponse.json({
      firebaseProject: "al-hadeed-traders",
      firestoreConnection: "success",
      totalCollections: collections.length,
      collectionNames,
      counts: {
        invoices: invoicesSnap.size,
        items: itemsSnap.size,
        parties: partiesSnap.size,
        journalentries: jvSnap.size
      },
      dashboardData,
      dashboardError,
      invoices
    });
  } catch (err: any) {
    return NextResponse.json({
      firebaseProject: "al-hadeed-traders",
      firestoreConnection: "error",
      error: err?.message || String(err)
    }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
