import { NextResponse } from "next/server";
import { getDocuments } from "@/lib/firestore/genericRepository";

export async function GET() {
  try {
    const [
      realInvoices, 
      realJournals, 
      realAccounts, 
      realParties, 
      realItems, 
      realEmployees, 
      realPayroll
    ] = await Promise.all([
      getDocuments("invoices"),
      getDocuments("journals"),
      getDocuments("accounts"),
      getDocuments("parties"),
      getDocuments("items"),
      getDocuments("employees"),
      getDocuments("payrolls")
    ]);

    const results: any = {
      "Maintain - Items & Stock": realItems,
      "Maintain - Customers": realParties.filter((p: any) => p.type === "Customer"),
      "Maintain - Vendors": realParties.filter((p: any) => p.type === "Vendor"),
      "Maintain - Employees": realEmployees,
      "Purchase Records": realInvoices.filter((i: any) => i.type === "purchase"),
      "Sale Records": realInvoices.filter((i: any) => i.type === "sale"),
      "Salary & Payroll": realPayroll,
      "Banks & Chart of Accounts": realAccounts,
    };

    return NextResponse.json(results);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
