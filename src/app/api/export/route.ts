import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getDocuments } from "@/lib/firestore/genericRepository";

export async function GET() {
  try {
    const workbook = XLSX.utils.book_new();

    const collections = [
      { name: "Accounts", col: "accounts" },
      { name: "Categories", col: "categories" },
      { name: "Doc Settings", col: "document_settings" },
      { name: "Employees", col: "employees" },
      { name: "Financial Years", col: "financial_years" },
      { name: "Inv Settings", col: "inventory_settings" },
      { name: "Invoices", col: "invoices" },
      { name: "Items", col: "items" },
      { name: "Journals", col: "journals" },
      { name: "Journal Entries", col: "journal_entries" },
      { name: "Payroll", col: "payrolls" },
      { name: "Print Formats", col: "print_formats" },
      { name: "Roles", col: "roles" },
      { name: "Shop Profile", col: "shop_profiles" },
      { name: "Users", col: "users" },
      { name: "Vehicle Logs", col: "vehicle_logs" },
    ];

    const cleanForExcel = (data: any[]) => {
      if (!data || !Array.isArray(data)) return [];
      return data.map((doc: any) => {
        const cleaned: any = {};
        for (const [key, value] of Object.entries(doc)) {
          if (key === "__v" || key === "password") continue;
          if (value && typeof value === 'object') {
            if (value instanceof Date) {
              cleaned[key] = value.toISOString();
            } else {
              try {
                cleaned[key] = JSON.stringify(value);
              } catch (e) {
                cleaned[key] = String(value);
              }
            }
          } else {
            cleaned[key] = value;
          }
        }
        return cleaned;
      });
    };

    for (const { name, col } of collections) {
      try {
        const data = await getDocuments(col);
        const cleanData = cleanForExcel(data);
        const ws = XLSX.utils.json_to_sheet(cleanData.length > 0 ? cleanData : [{ Info: "No data" }]);
        XLSX.utils.book_append_sheet(workbook, ws, name.substring(0, 31));
      } catch (err) {
        console.error(`Error exporting ${name}:`, err);
      }
    }

    try {
      const allParties = await getDocuments("parties");
      const customers = cleanForExcel(allParties.filter((p: any) => p.type === "Customer"));
      const vendors = cleanForExcel(allParties.filter((p: any) => p.type === "Vendor"));
      
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(customers.length > 0 ? customers : [{ Info: "No Customers" }]), "Customers");
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(vendors.length > 0 ? vendors : [{ Info: "No Vendors" }]), "Vendors");
    } catch (err) {
      console.error("Error exporting parties:", err);
    }

    const buf = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="oilshop_export_${timestamp}.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error("Critical Export Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
