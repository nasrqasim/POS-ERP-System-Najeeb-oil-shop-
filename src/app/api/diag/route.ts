import { adminDb } from "@/lib/firestore/admin";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const collections = await adminDb.listCollections();
    const collectionDetails: Record<string, number> = {};

    for (const col of collections) {
      const snap = await col.get();
      collectionDetails[col.id] = snap.docs.length;
    }

    return NextResponse.json({
      firebaseProject: "al-hadeed-traders",
      firestoreConnection: "success",
      totalCollections: collections.length,
      collections: collectionDetails
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
