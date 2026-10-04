import { ok, fail } from "@/lib/api";
import { getAllInvoices } from "@/lib/firestore/invoicesRepository";
import { 
  getAllCashReceipts, 
  getAllCashPayments, 
  getAllBankReceipts, 
  getAllBankPayments 
} from "@/lib/firestore/paymentsRepository";
import { getDocuments } from "@/lib/firestore/genericRepository";
import { calculateCashBankLedger } from "@/lib/centralizedBalanceService";

export async function GET(req: Request) {
  try {
    const [
      allInvoices,
      cashReceipts,
      bankReceipts,
      cashPayments,
      bankPayments,
      otherIncomes,
      expenses,
      accounts
    ] = await Promise.all([
      getAllInvoices(),
      getAllCashReceipts(),
      getAllBankReceipts(),
      getAllCashPayments(),
      getAllBankPayments(),
      getDocuments("incomes"),
      getDocuments("expenses"),
      getDocuments("accounts")
    ]);

    // Calculate initial opening from cash & bank accounts
    const cashBankAccounts = accounts.filter((a: any) => 
      ["cash", "bank"].includes(String(a.type || "").toLowerCase()) ||
      ["1111", "1110"].includes(a.code)
    );
    const initialOpening = cashBankAccounts.reduce((sum, a) => sum + (Number(a.openingBalance) || 0), 0);

    const { txs, closing } = calculateCashBankLedger(
      initialOpening,
      allInvoices,
      cashReceipts,
      bankReceipts,
      cashPayments,
      bankPayments,
      otherIncomes,
      expenses
    );

    return ok({ 
      opening: initialOpening,
      closing,
      transactions: txs,
      cashBankAccounts
    });
  } catch (error: any) {
    console.error("Cash Bank Ledger Error:", error);
    return fail(error.message, 500);
  }
}
