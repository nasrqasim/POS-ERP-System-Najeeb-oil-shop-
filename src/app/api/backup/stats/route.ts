import { NextResponse } from "next/server";
import { getDocuments } from "@/lib/firestore/genericRepository";

export async function GET() {
  try {
    const [
      accounts,
      categories,
      employees,
      invoices,
      items,
      cashReceipts,
      bankPayments,
      parties,
      payrolls,
      users
    ] = await Promise.all([
      getDocuments("accounts"),
      getDocuments("categories"),
      getDocuments("employees"),
      getDocuments("invoices"),
      getDocuments("items"),
      getDocuments("cash_receipts"),
      getDocuments("bank_payments"),
      getDocuments("parties"),
      getDocuments("payrolls"),
      getDocuments("users")
    ]);

    const customers = parties.filter((p: any) => p.type === "Customer");
    const vendors = parties.filter((p: any) => p.type === "Vendor");

    const stats = [
      { name: "Bank Accounts", count: accounts.length, status: "ok" },
      { name: "Categories", count: categories.length, status: "ok" },
      { name: "Employees", count: employees.length, status: "ok" },
      { name: "Invoices", count: invoices.length, status: "ok" },
      { name: "Inventory Items", count: items.length, status: "ok" },
      { name: "Cash Receipts", count: cashReceipts.length, status: "ok" },
      { name: "Bank Payments", count: bankPayments.length, status: "ok" },
      { name: "Customers", count: customers.length, status: "ok" },
      { name: "Vendors", count: vendors.length, status: "ok" },
      { name: "Payroll Records", count: payrolls.length, status: "ok" },
      { name: "Users", count: users.length, status: "ok" },
    ];

    return NextResponse.json({ stats });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
