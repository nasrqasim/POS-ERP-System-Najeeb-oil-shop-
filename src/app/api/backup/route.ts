import { NextResponse } from "next/server";
import JSZip from "jszip";
import { getDocuments } from "@/lib/firestore/genericRepository";

export async function GET() {
  try {
    const zip = new JSZip();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const folderName = `oilshop_backup_${timestamp}`;
    const backupFolder = zip.folder(folderName);

    const collections = [
      "accounts",
      "categories",
      "document_settings",
      "employees",
      "financial_years",
      "inventory_settings",
      "invoices",
      "items",
      "journals",
      "journal_entries",
      "payrolls",
      "print_formats",
      "roles",
      "shop_profiles",
      "users",
      "vehicle_logs",
      "cash_receipts",
      "bank_receipts",
      "cash_payments",
      "bank_payments"
    ];

    for (const col of collections) {
      try {
        const data = await getDocuments(col);
        backupFolder?.file(`${col}.json`, JSON.stringify(data, null, 2));
      } catch (err) {
        console.error(`Error backing up ${col}:`, err);
        backupFolder?.file(`${col}.json`, "[]");
      }
    }

    try {
      const allParties = await getDocuments("parties");
      const customers = allParties.filter((p: any) => p.type === "Customer");
      const vendors = allParties.filter((p: any) => p.type === "Vendor");
      
      backupFolder?.file(`customers.json`, JSON.stringify(customers, null, 2));
      backupFolder?.file(`vendors.json`, JSON.stringify(vendors, null, 2));
      backupFolder?.file(`all_parties.json`, JSON.stringify(allParties, null, 2));
    } catch (err) {
      console.error("Error backing up parties:", err);
      backupFolder?.file(`customers.json`, "[]");
      backupFolder?.file(`vendors.json`, "[]");
    }

    const content = await zip.generateAsync({ type: "uint8array" });

    return new NextResponse(content as any, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename=oilshop_backup_${timestamp}.zip`,
      },
    });
  } catch (error: any) {
    console.error("Backup error:", error);
    return NextResponse.json(
      { error: "Failed to create backup", details: error.message },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
