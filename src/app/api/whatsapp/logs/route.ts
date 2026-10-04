import { NextResponse } from "next/server";
import { getDocuments } from "@/lib/firestore/genericRepository";

export async function GET() {
  try {
    const logs = await getDocuments("message_logs");
    logs.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    return NextResponse.json({ ok: true, data: logs.slice(0, 100) });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
