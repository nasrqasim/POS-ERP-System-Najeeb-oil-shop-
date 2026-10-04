import { fail, ok } from "@/lib/api";
import { getDocuments, createDocument } from "@/lib/firestore/genericRepository";

export const dynamic = "force-dynamic";

const DEFAULT_ACCOUNTS = [
  { code: "1111", title: "Cash in Hand", type: "cash", openingBalance: 0 },
  { code: "1110", title: "Main Bank Account", type: "bank", openingBalance: 0 },
  { code: "1100", title: "Accounts Receivable", type: "asset", openingBalance: 0 },
  { code: "2100", title: "Accounts Payable", type: "liability", openingBalance: 0 },
  { code: "4100", title: "Sales Revenue", type: "revenue", openingBalance: 0 },
  { code: "5100", title: "Purchases Account", type: "expense", openingBalance: 0 }
];

export async function GET() {
  try {
    let accounts = await getDocuments("accounts");
    if (!accounts || accounts.length === 0) {
      for (const a of DEFAULT_ACCOUNTS) {
        await createDocument("accounts", a);
      }
      accounts = await getDocuments("accounts");
    }

    accounts.sort((a: any, b: any) => String(a.code || "").localeCompare(String(b.code || "")));
    
    const journalEntries = await getDocuments("journal_entries");

    // Group debit and credit by accountCode
    const totalsByCode: Record<string, { debits: number; credits: number }> = {};
    for (const jv of journalEntries) {
      if (!jv.accountCode) continue;
      if (!totalsByCode[jv.accountCode]) {
        totalsByCode[jv.accountCode] = { debits: 0, credits: 0 };
      }
      totalsByCode[jv.accountCode].debits += Number(jv.debit || 0);
      totalsByCode[jv.accountCode].credits += Number(jv.credit || 0);
    }

    const rows = accounts.map((acc: any) => {
      const codeTotals = totalsByCode[acc.code] || { debits: 0, credits: 0 };
      let balance = Number(acc.openingBalance || 0);
      const isDebit = ["cash", "bank", "expense", "receivable", "asset"].includes(String(acc.type || "").toLowerCase());
      if (isDebit) {
        balance += codeTotals.debits - codeTotals.credits;
      } else {
        balance += codeTotals.credits - codeTotals.debits;
      }
      return {
        ...acc,
        currentBalance: balance
      };
    });

    return ok(rows);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const row = await createDocument("accounts", body);
    return ok(row, 201);
  } catch (e) {
    return fail((e as Error).message);
  }
}
