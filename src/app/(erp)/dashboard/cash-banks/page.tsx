"use client";

import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Printer, Calendar, Wallet, Landmark, RefreshCw, FileSpreadsheet, Download } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { exportToExcel, printListDocument } from "@/lib/excel";

export default function CashBanksPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [journalEntries, setJournalEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedPeriod, setSelectedPeriod] = useState<"today" | "yesterday" | "thisWeek" | "thisMonth" | "thisYear" | "custom">("thisMonth");
  const [customFromDate, setCustomFromDate] = useState(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  });
  const [customToDate, setCustomToDate] = useState(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(year, d.getMonth() + 1, 0).getDate();
    return `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
  });

  const [activeViewTab, setActiveViewTab] = useState<"daily" | "monthly" | "yearly" | "overall">("daily");

  const anchorDate = new Date();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [accRes, jvRes] = await Promise.all([
        fetch("/api/accounts"),
        fetch("/api/journal-entries")
      ]);
      const accJson = await accRes.json();
      const jvJson = await jvRes.json();
      if (accJson.ok) setAccounts(accJson.data);
      if (jvJson.ok) setJournalEntries(jvJson.data);
    } catch (e) {
      console.error("Error fetching cash banks data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Compute date range based on selectedPeriod
  const dateRange = useMemo(() => {
    let start = new Date(anchorDate);
    let end = new Date(anchorDate);

    if (selectedPeriod === "today") {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (selectedPeriod === "yesterday") {
      start.setDate(anchorDate.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(anchorDate.getDate() - 1);
      end.setHours(23, 59, 59, 999);
    } else if (selectedPeriod === "thisWeek") {
      // Monday to Sunday of current week
      const currentDay = anchorDate.getDay();
      const distanceToMon = currentDay === 0 ? -6 : 1 - currentDay;
      start.setDate(anchorDate.getDate() + distanceToMon);
      start.setHours(0, 0, 0, 0);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else if (selectedPeriod === "thisMonth") {
      start = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1, 0, 0, 0, 0);
      end = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (selectedPeriod === "thisYear") {
      start = new Date(anchorDate.getFullYear(), 0, 1, 0, 0, 0, 0);
      end = new Date(anchorDate.getFullYear(), 11, 31, 23, 59, 59, 999);
    } else if (selectedPeriod === "custom") {
      const fromSplit = customFromDate.split("-").map(Number);
      const toSplit = customToDate.split("-").map(Number);
      start = new Date(fromSplit[0], fromSplit[1] - 1, fromSplit[2], 0, 0, 0, 0);
      end = new Date(toSplit[0], toSplit[1] - 1, toSplit[2], 23, 59, 59, 999);
    }

    return { start, end };
  }, [selectedPeriod, customFromDate, customToDate]);

  // Filter Cash and Bank accounts & codes
  const { cashBankAccounts, cashBankCodes, initialOpening } = useMemo(() => {
    const filtered = accounts.filter((a: any) => 
      ["cash", "bank"].includes(String(a.type || "").toLowerCase()) ||
      ["1111", "1110"].includes(a.code)
    );
    const codes = filtered.map(a => a.code);
    const opBalance = filtered.reduce((sum, a) => sum + (a.openingBalance ?? 0), 0);
    return { cashBankAccounts: filtered, cashBankCodes: codes, initialOpening: opBalance };
  }, [accounts]);

  // Filter journal entries for Cash & Bank accounts
  const cashBankEntries = useMemo(() => {
    return journalEntries.filter(e => cashBankCodes.includes(e.accountCode));
  }, [journalEntries, cashBankCodes]);

  // Classify transactions in a given range into the required categories
  const classifyRange = (entries: any[], start: Date, end: Date) => {
    let cashReceipts = 0;
    let bankReceipts = 0;
    let salesReceipts = 0;
    let otherIncome = 0;
    let payments = 0;
    let expenses = 0;
    let withdrawals = 0;
    let deposits = 0;

    entries.forEach(entry => {
      const entryDate = new Date(entry.date);
      if (entryDate.getTime() >= start.getTime() && entryDate.getTime() <= end.getTime()) {
        const debit = Number(entry.debit) || 0;
        const credit = Number(entry.credit) || 0;
        const vNo = (entry.voucherNo || "").toUpperCase();
        const remarks = (entry.remarks || "").toLowerCase();
        const accTitle = (entry.accountTitle || "").toLowerCase();
        
        const isCashAcc = entry.accountCode === "1111" || accTitle.includes("cash");
        const isBankAcc = entry.accountCode === "1110" || accTitle.includes("bank");

        if (debit > 0) {
          // Check if transfer (withdraw/deposit)
          const isWithdraw = remarks.includes("withdraw");
          const isDeposit = remarks.includes("deposit");

          // Check if sales collection
          const isSales = vNo.startsWith("SI") || vNo.startsWith("POS") || vNo.startsWith("CRV") || vNo.startsWith("BRV") || remarks.includes("sale") || remarks.includes("customer") || remarks.includes("recovery") || remarks.includes("down payment") || remarks.includes("collection");
          
          // Check if other income
          const isOtherIncome = vNo.startsWith("INC") || remarks.includes("other income") || remarks.includes("commission") || remarks.includes("interest") || remarks.includes("rent") || remarks.includes("income") || vNo.startsWith("OIV");

          if (isSales) {
            salesReceipts += debit;
          } else if (isOtherIncome) {
            otherIncome += debit;
          } else if (isCashAcc && isWithdraw) {
            withdrawals += debit; // Cash debited from bank withdrawal
          } else if (isBankAcc && isDeposit) {
            deposits += debit; // Bank debited from cash deposit
          } else {
            if (isCashAcc) cashReceipts += debit;
            else if (isBankAcc) bankReceipts += debit;
          }
        } else if (credit > 0) {
          const isWithdraw = remarks.includes("withdraw");
          const isDeposit = remarks.includes("deposit");

          // Credit: Cash/Bank is reduced
          // Check if it is an expense
          const isExpense = entry.accountCode?.startsWith("5") || entry.accountCode?.startsWith("6") || remarks.includes("expense") || remarks.includes("salary") || remarks.includes("bill") || remarks.includes("repairs") || remarks.includes("rent");
          
          if (isCashAcc && isDeposit) {
            deposits += credit; // Cash credited for bank deposit
          } else if (isBankAcc && isWithdraw) {
            withdrawals += credit; // Bank credited for cash withdrawal
          } else if (isExpense) {
            expenses += credit;
          } else {
            payments += credit;
          }
        }
      }
    });

    return {
      cashReceipts,
      bankReceipts,
      salesReceipts,
      otherIncome,
      payments,
      expenses,
      withdrawals,
      deposits
    };
  };

  // Helper: compute period summary values
  const getPeriodNumbers = (start: Date, end: Date) => {
    let beforeDebit = 0;
    let beforeCredit = 0;

    cashBankEntries.forEach(entry => {
      const entryDate = new Date(entry.date);
      if (entryDate.getTime() < start.getTime()) {
        beforeDebit += entry.debit || 0;
        beforeCredit += entry.credit || 0;
      }
    });

    const opening = initialOpening + beforeDebit - beforeCredit;
    const stats = classifyRange(cashBankEntries, start, end);
    
    // Balance calculation matching formula:
    // current = opening + cashReceipts + bankReceipts + salesReceipts + otherIncome - payments - expenses
    // note: deposits and withdrawals are internal transfers, they cancel out on overall Cash & Banks balance
    const current = opening + stats.cashReceipts + stats.bankReceipts + stats.salesReceipts + stats.otherIncome - stats.payments - stats.expenses;

    return {
      opening,
      ...stats,
      current
    };
  };

  // Filtered period metrics
  const activePeriodMetrics = useMemo(() => {
    return getPeriodNumbers(dateRange.start, dateRange.end);
  }, [cashBankEntries, initialOpening, dateRange]);

  // Today Summary
  const todayMetrics = useMemo(() => {
    const start = new Date(anchorDate); start.setHours(0,0,0,0);
    const end = new Date(anchorDate); end.setHours(23,59,59,999);
    return getPeriodNumbers(start, end);
  }, [cashBankEntries, initialOpening]);

  // Month Summary
  const monthMetrics = useMemo(() => {
    const start = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0, 23, 59, 59, 999);
    return getPeriodNumbers(start, end);
  }, [cashBankEntries, initialOpening]);

  // Year Summary
  const yearMetrics = useMemo(() => {
    const start = new Date(anchorDate.getFullYear(), 0, 1, 0, 0, 0, 0);
    const end = new Date(anchorDate.getFullYear(), 11, 31, 23, 59, 59, 999);
    return getPeriodNumbers(start, end);
  }, [cashBankEntries, initialOpening]);

  // Overall Summary
  const overallMetrics = useMemo(() => {
    const start = new Date(0);
    const end = new Date("2100-01-01");
    return getPeriodNumbers(start, end);
  }, [cashBankEntries, initialOpening]);

  // Tab Rows Generation
  // 1. Daily Tab Rows
  const dailyRows = useMemo(() => {
    const dates: Record<string, Date> = {};
    cashBankEntries.forEach(entry => {
      const d = new Date(entry.date);
      if (d.getTime() >= dateRange.start.getTime() && d.getTime() <= dateRange.end.getTime()) {
        const str = d.toISOString().split("T")[0];
        dates[str] = d;
      }
    });

    const sortedDates = Object.values(dates).sort((a, b) => a.getTime() - b.getTime());
    
    return sortedDates.map(d => {
      const start = new Date(d); start.setHours(0,0,0,0);
      const end = new Date(d); end.setHours(23,59,59,999);
      const metrics = getPeriodNumbers(start, end);
      return {
        key: d.toISOString().split("T")[0],
        label: d.toLocaleDateString(),
        ...metrics
      };
    });
  }, [cashBankEntries, dateRange, initialOpening]);

  // 2. Monthly Tab Rows
  const monthlyRows = useMemo(() => {
    const months: Record<string, { year: number; month: number }> = {};
    cashBankEntries.forEach(entry => {
      const d = new Date(entry.date);
      if (d.getTime() >= dateRange.start.getTime() && d.getTime() <= dateRange.end.getTime()) {
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        months[key] = { year: d.getFullYear(), month: d.getMonth() };
      }
    });

    const sortedMonths = Object.values(months).sort((a,b) => (a.year * 12 + a.month) - (b.year * 12 + b.month));
    
    return sortedMonths.map(m => {
      const start = new Date(m.year, m.month, 1, 0, 0, 0, 0);
      const end = new Date(m.year, m.month + 1, 0, 23, 59, 59, 999);
      const label = start.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      const metrics = getPeriodNumbers(start, end);
      return {
        key: `${m.year}-${m.month}`,
        label,
        ...metrics
      };
    });
  }, [cashBankEntries, dateRange, initialOpening]);

  // 3. Yearly Tab Rows
  const yearlyRows = useMemo(() => {
    const years: Record<number, number> = {};
    cashBankEntries.forEach(entry => {
      const d = new Date(entry.date);
      if (d.getTime() >= dateRange.start.getTime() && d.getTime() <= dateRange.end.getTime()) {
        years[d.getFullYear()] = d.getFullYear();
      }
    });

    const sortedYears = Object.values(years).sort((a,b) => a - b);
    
    return sortedYears.map(y => {
      const start = new Date(y, 0, 1, 0, 0, 0, 0);
      const end = new Date(y, 11, 31, 23, 59, 59, 999);
      const metrics = getPeriodNumbers(start, end);
      return {
        key: String(y),
        label: String(y),
        ...metrics
      };
    });
  }, [cashBankEntries, dateRange, initialOpening]);

  // 4. Overall Accounts
  const overallAccounts = useMemo(() => {
    return cashBankAccounts.map(acc => {
      let debit = 0;
      let credit = 0;
      journalEntries.forEach(e => {
        const entryDate = new Date(e.date);
        if (e.accountCode === acc.code && entryDate.getTime() >= dateRange.start.getTime() && entryDate.getTime() <= dateRange.end.getTime()) {
          debit += e.debit || 0;
          credit += e.credit || 0;
        }
      });

      // Calculate account opening before dateRange.start
      let beforeD = 0;
      let beforeC = 0;
      journalEntries.forEach(e => {
        const entryDate = new Date(e.date);
        if (e.accountCode === acc.code && entryDate.getTime() < dateRange.start.getTime()) {
          beforeD += e.debit || 0;
          beforeC += e.credit || 0;
        }
      });
      const opening = (acc.openingBalance || 0) + beforeD - beforeC;
      const balance = opening + debit - credit;
      return {
        ...acc,
        opening,
        debit,
        credit,
        balance
      };
    });
  }, [cashBankAccounts, journalEntries, dateRange]);

  // Individual Journal Transactions inside dateRange
  const periodTransactions = useMemo(() => {
    const sorted = cashBankEntries
      .filter(e => {
        const d = new Date(e.date);
        return d.getTime() >= dateRange.start.getTime() && d.getTime() <= dateRange.end.getTime();
      })
      .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    let bal = activePeriodMetrics.opening;
    return sorted.map(e => {
      bal = bal + (e.debit || 0) - (e.credit || 0);
      const vNo = (e.voucherNo || "").toUpperCase();
      const remarks = (e.remarks || "").toLowerCase();
      const accCode = e.accountCode || "";

      let voucherType = "Journal";
      let moduleName = "General Ledger";
      let source = "Journal Entry";

      if (vNo.startsWith("SI-")) {
        voucherType = "Sale Invoice";
        moduleName = "Sales";
        source = "Sale Invoice";
      } else if (vNo.startsWith("POS-")) {
        voucherType = "POS Sale";
        moduleName = "POS";
        source = "POS Sale";
      } else if (vNo.startsWith("CRV-")) {
        voucherType = "Cash Receipt";
        moduleName = "Receipts";
        source = "Cash Receipt";
      } else if (vNo.startsWith("BRV-")) {
        voucherType = "Bank Receipt";
        moduleName = "Receipts";
        source = "Bank Receipt";
      } else if (vNo.startsWith("CPV-")) {
        const isExpense = accCode.startsWith("5") || accCode.startsWith("6") || remarks.includes("expense");
        voucherType = isExpense ? "Expense Voucher" : "Cash Payment";
        moduleName = isExpense ? "Expenses" : "Payments";
        source = "Cash Payment";
      } else if (vNo.startsWith("BPV-")) {
        const isExpense = accCode.startsWith("5") || accCode.startsWith("6") || remarks.includes("expense");
        voucherType = isExpense ? "Expense Voucher" : "Bank Payment";
        moduleName = isExpense ? "Expenses" : "Payments";
        source = "Bank Payment";
      } else if (vNo.startsWith("INC-")) {
        voucherType = "Other Income";
        moduleName = "Receipts";
        source = "Other Income";
      } else if (vNo.startsWith("SR-")) {
        voucherType = "Sale Return";
        moduleName = "Sales";
        source = "Sale Return";
      } else if (vNo.startsWith("PR-") || vNo.startsWith("PUR-")) {
        voucherType = "Purchase Invoice";
        moduleName = "Purchases";
        source = "Purchase Invoice";
      }

      return {
        ...e,
        runningBalance: bal,
        voucherType,
        module: moduleName,
        source
      };
    });
  }, [cashBankEntries, dateRange, activePeriodMetrics.opening]);

  const fmt = (n: number) => Math.round(n).toLocaleString();

  // Excel Export Handler
  const handleExportExcel = () => {
    if (activeViewTab === "overall") {
      const data = overallAccounts.map(acc => ({
        "Account Code": acc.code,
        "Account Title": acc.title || acc.name,
        "Type": acc.type,
        "Opening Balance": acc.opening,
        "Debits": acc.debit,
        "Credits": acc.credit,
        "Closing Balance": acc.balance
      }));
      exportToExcel(data, `Cash_Banks_Accounts_${selectedPeriod}.xlsx`);
    } else {
      const rows = activeViewTab === "daily" ? dailyRows : activeViewTab === "monthly" ? monthlyRows : yearlyRows;
      const data = rows.map(r => ({
        "Period": r.label,
        "Opening Balance": r.opening,
        "Cash Receipts": r.cashReceipts,
        "Bank Receipts": r.bankReceipts,
        "Sales Collections": r.salesReceipts,
        "Other Income": r.otherIncome,
        "Payments": r.payments,
        "Expenses": r.expenses,
        "Deposits": r.deposits,
        "Withdrawals": r.withdrawals,
        "Closing Balance": r.current
      }));
      exportToExcel(data, `Cash_Banks_Summary_${activeViewTab}_${selectedPeriod}.xlsx`);
    }
  };

  // PDF / Print List Report Handler
  const handlePrintReport = () => {
    if (activeViewTab === "overall") {
      printListDocument({
        title: `Cash & Banks Accounts Summary (${selectedPeriod.toUpperCase()})`,
        columns: [
          { header: "Account Code", key: "code" },
          { header: "Account Title", key: "title" },
          { header: "Account Type", key: "type" },
          { header: "Opening Balance", key: "fmtOpening" },
          { header: "Debit Sum", key: "fmtDebit" },
          { header: "Credit Sum", key: "fmtCredit" },
          { header: "Closing Balance", key: "fmtBalance" }
        ],
        rows: overallAccounts.map(acc => ({
          code: acc.code,
          title: acc.title || acc.name,
          type: acc.type,
          fmtOpening: `PKR ${fmt(acc.opening)}`,
          fmtDebit: `PKR ${fmt(acc.debit)}`,
          fmtCredit: `PKR ${fmt(acc.credit)}`,
          fmtBalance: `PKR ${fmt(acc.balance)}`
        })),
        totals: {
          code: "TOTAL",
          title: "",
          type: "",
          fmtOpening: `PKR ${fmt(overallAccounts.reduce((s,a) => s + a.opening, 0))}`,
          fmtDebit: `PKR ${fmt(overallAccounts.reduce((s,a) => s + a.debit, 0))}`,
          fmtCredit: `PKR ${fmt(overallAccounts.reduce((s,a) => s + a.credit, 0))}`,
          fmtBalance: `PKR ${fmt(overallAccounts.reduce((s,a) => s + a.balance, 0))}`
        }
      });
    } else {
      const rows = activeViewTab === "daily" ? dailyRows : activeViewTab === "monthly" ? monthlyRows : yearlyRows;
      printListDocument({
        title: `Cash & Banks Period Summary (${activeViewTab.toUpperCase()} - ${selectedPeriod.toUpperCase()})`,
        columns: [
          { header: "Period", key: "label" },
          { header: "Opening Balance", key: "fmtOpening" },
          { header: "Cash Receipts", key: "fmtCashRec" },
          { header: "Bank Receipts", key: "fmtBankRec" },
          { header: "Sales collections", key: "fmtSalesRec" },
          { header: "Other Income", key: "fmtOtherIncome" },
          { header: "Payments", key: "fmtPayments" },
          { header: "Expenses", key: "fmtExpenses" },
          { header: "Closing Balance", key: "fmtClosing" }
        ],
        rows: rows.map(r => ({
          label: r.label,
          fmtOpening: `PKR ${fmt(r.opening)}`,
          fmtCashRec: `PKR ${fmt(r.cashReceipts)}`,
          fmtBankRec: `PKR ${fmt(r.bankReceipts)}`,
          fmtSalesRec: `PKR ${fmt(r.salesReceipts)}`,
          fmtOtherIncome: `PKR ${fmt(r.otherIncome)}`,
          fmtPayments: `PKR ${fmt(r.payments)}`,
          fmtExpenses: `PKR ${fmt(r.expenses)}`,
          fmtClosing: `PKR ${fmt(r.current)}`
        })),
        totals: {
          label: "TOTAL / SUMMARY",
          fmtOpening: `PKR ${fmt(rows[0]?.opening || 0)}`,
          fmtCashRec: `PKR ${fmt(rows.reduce((s,r) => s + r.cashReceipts, 0))}`,
          fmtBankRec: `PKR ${fmt(rows.reduce((s,r) => s + r.bankReceipts, 0))}`,
          fmtSalesRec: `PKR ${fmt(rows.reduce((s,r) => s + r.salesReceipts, 0))}`,
          fmtOtherIncome: `PKR ${fmt(rows.reduce((s,r) => s + r.otherIncome, 0))}`,
          fmtPayments: `PKR ${fmt(rows.reduce((s,r) => s + r.payments, 0))}`,
          fmtExpenses: `PKR ${fmt(rows.reduce((s,r) => s + r.expenses, 0))}`,
          fmtClosing: `PKR ${fmt(rows[rows.length - 1]?.current || 0)}`
        }
      });
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 pb-24">
      {/* Header */}
      <div className="flex justify-between items-center no-print">
        <Link 
          href="/dashboard"
          className="flex items-center gap-2 px-6 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-white rounded-xl text-sm font-black transition-all"
        >
          <ArrowLeft size={18} />
          Back to Dashboard
        </Link>
        <div className="flex gap-2">
          <button 
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-black shadow-lg transition-all"
          >
            <FileSpreadsheet size={18} />
            Export Excel
          </button>
          <button 
            onClick={handlePrintReport}
            className="flex items-center gap-2 px-6 py-2.5 bg-maroon-850 hover:bg-maroon-900 text-white rounded-xl text-sm font-black shadow-lg transition-all"
          >
            <Printer size={18} />
            Print Analysis
          </button>
        </div>
      </div>

      {/* Main Title */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Cash & Banks Analysis</h1>
        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Periodical liquidity and account balances summary</p>
      </div>

      {/* Date Period Filters Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm no-print">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Select Report Period</span>
            <div className="flex flex-wrap gap-2 pt-1">
              {[
                { id: "today", label: "Today" },
                { id: "yesterday", label: "Yesterday" },
                { id: "thisWeek", label: "This Week" },
                { id: "thisMonth", label: "This Month" },
                { id: "thisYear", label: "This Year" },
                { id: "custom", label: "Custom Range" }
              ].map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPeriod(p.id as any)}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${
                    selectedPeriod === p.id 
                      ? "bg-maroon-800 text-white shadow" 
                      : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {selectedPeriod === "custom" && (
            <div className="flex items-center gap-2">
              <div className="space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">From Date</span>
                <input 
                  type="date" 
                  value={customFromDate}
                  onChange={e => setCustomFromDate(e.target.value)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 dark:bg-slate-950 rounded-xl text-sm font-bold focus:outline-none dark:text-white"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">To Date</span>
                <input 
                  type="date" 
                  value={customToDate}
                  onChange={e => setCustomToDate(e.target.value)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 dark:bg-slate-950 rounded-xl text-sm font-bold focus:outline-none dark:text-white"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Period Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Today Balance", data: todayMetrics, color: "border-emerald-500" },
          { label: "Monthly Balance", data: monthMetrics, color: "border-blue-500" },
          { label: "Yearly Balance", data: yearMetrics, color: "border-orange-500" },
          { label: "Filtered Period Balance", data: activePeriodMetrics, color: "border-maroon-600" }
        ].map((card, idx) => (
          <div key={idx} className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm border-l-4 ${card.color}`}>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{card.label}</p>
            <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1">PKR {fmt(card.data.current)}</h3>
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-500 space-y-1">
              <div className="flex justify-between">
                <span>Opening:</span>
                <span>PKR {fmt(Math.abs(card.data.opening))}</span>
              </div>
              <div className="flex justify-between">
                <span>Sales Collections:</span>
                <span className="text-emerald-600">PKR {fmt(card.data.salesReceipts)}</span>
              </div>
              <div className="flex justify-between">
                <span>Other Income:</span>
                <span className="text-blue-600">PKR {fmt(card.data.otherIncome)}</span>
              </div>
              <div className="flex justify-between">
                <span>Payments:</span>
                <span className="text-rose-600">PKR ({fmt(card.data.payments)})</span>
              </div>
              <div className="flex justify-between">
                <span>Expenses:</span>
                <span className="text-rose-600">PKR ({fmt(card.data.expenses)})</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* View Selector Tabs */}
      <div className="bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl flex gap-1 border border-slate-200 dark:border-slate-800 no-print">
        {[
          { id: "daily", label: "Daily View" },
          { id: "monthly", label: "Monthly View" },
          { id: "yearly", label: "Yearly View" },
          { id: "overall", label: "Accounts & Balances" }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveViewTab(tab.id as any)}
            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              activeViewTab === tab.id
                ? "bg-white dark:bg-slate-800 text-maroon-800 dark:text-white shadow-sm"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-350"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Details Area */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-6 shadow-sm min-h-[350px]">
        {loading ? (
          <div className="py-24 text-center text-slate-400">
            <RefreshCw size={36} className="animate-spin text-maroon-850 mx-auto mb-4" />
            <p className="text-xs font-black uppercase tracking-widest">Compiling liquidity logs...</p>
          </div>
        ) : (
          <>
            {activeViewTab !== "overall" ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-400 font-black uppercase tracking-wider">
                      <th className="px-4 py-3.5">Period / Date</th>
                      <th className="px-4 py-3.5 text-right">Opening Balance</th>
                      <th className="px-4 py-3.5 text-right">Sales Receipts</th>
                      <th className="px-4 py-3.5 text-right">Other Income</th>
                      <th className="px-4 py-3.5 text-right">Cash Receipts</th>
                      <th className="px-4 py-3.5 text-right">Bank Receipts</th>
                      <th className="px-4 py-3.5 text-right">Payments (-)</th>
                      <th className="px-4 py-3.5 text-right">Expenses (-)</th>
                      <th className="px-4 py-3.5 text-right">Deposits (+)</th>
                      <th className="px-4 py-3.5 text-right">Withdrawals (-)</th>
                      <th className="px-4 py-3.5 text-right">Closing Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-850 font-bold text-slate-700 dark:text-slate-300">
                    {(activeViewTab === "daily" ? dailyRows : activeViewTab === "monthly" ? monthlyRows : yearlyRows).map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="px-4 py-3.5 text-slate-900 dark:text-white font-extrabold">{row.label}</td>
                        <td className="px-4 py-3.5 text-right">PKR {fmt(Math.abs(row.opening))}</td>
                        <td className="px-4 py-3.5 text-right text-emerald-600">+PKR {fmt(row.salesReceipts)}</td>
                        <td className="px-4 py-3.5 text-right text-blue-600">+PKR {fmt(row.otherIncome)}</td>
                        <td className="px-4 py-3.5 text-right text-teal-600">+PKR {fmt(row.cashReceipts)}</td>
                        <td className="px-4 py-3.5 text-right text-indigo-600">+PKR {fmt(row.bankReceipts)}</td>
                        <td className="px-4 py-3.5 text-right text-rose-600">-PKR {fmt(row.payments)}</td>
                        <td className="px-4 py-3.5 text-right text-rose-600">-PKR {fmt(row.expenses)}</td>
                        <td className="px-4 py-3.5 text-right text-slate-500">+PKR {fmt(row.deposits)}</td>
                        <td className="px-4 py-3.5 text-right text-slate-500">-PKR {fmt(row.withdrawals)}</td>
                        <td className="px-4 py-3.5 text-right text-slate-900 dark:text-white font-black">PKR {fmt(row.current)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Cash & Bank Accounts</h3>
                  <div className="overflow-x-auto border border-slate-100 dark:border-slate-850 rounded-2xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-400 font-black uppercase tracking-wider">
                          <th className="px-4 py-3.5">Account Code</th>
                          <th className="px-4 py-3.5">Account Title</th>
                          <th className="px-4 py-3.5">Account Type</th>
                          <th className="px-4 py-3.5 text-right">Opening Balance</th>
                          <th className="px-4 py-3.5 text-right">Debit Sum</th>
                          <th className="px-4 py-3.5 text-right">Credit Sum</th>
                          <th className="px-4 py-3.5 text-right">Closing Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-850 font-bold text-slate-700 dark:text-slate-300">
                        {overallAccounts.map((acc, idx) => (
                          <tr 
                            key={idx} 
                            onClick={() => router.push(`/maintain/accounts?accountCode=${acc.code}`)}
                            className="hover:bg-maroon-50/10 dark:hover:bg-slate-850/50 transition-colors cursor-pointer"
                            title="Click to view full account ledger"
                          >
                            <td className="px-4 py-3.5 text-blue-600 font-extrabold">{acc.code}</td>
                            <td className="px-4 py-3.5 text-slate-900 dark:text-white font-extrabold">{acc.title || acc.name}</td>
                            <td className="px-4 py-3.5 capitalize text-slate-400">{acc.type} Ledger</td>
                            <td className="px-4 py-3.5 text-right text-slate-600">PKR {fmt(Math.abs(acc.opening))}</td>
                            <td className="px-4 py-3.5 text-right text-emerald-600">PKR {fmt(acc.debit)}</td>
                            <td className="px-4 py-3.5 text-right text-rose-600">PKR {fmt(acc.credit)}</td>
                            <td className="px-4 py-3.5 text-right text-slate-900 dark:text-white font-black">PKR {fmt(acc.balance)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Transaction List Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-6 shadow-sm">
        <div className="mb-4">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Ledger Transaction History</h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Chronological transactions listing for the filtered period</p>
        </div>

        <div className="overflow-x-auto border border-slate-100 dark:border-slate-850 rounded-2xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-400 font-black uppercase tracking-wider">
                <th className="px-4 py-3.5 w-24">Date</th>
                <th className="px-4 py-3.5 w-32">Voucher #</th>
                <th className="px-4 py-3.5 w-32">Voucher Type</th>
                <th className="px-4 py-3.5 w-24">Module</th>
                <th className="px-4 py-3.5 w-32">Account</th>
                <th className="px-4 py-3.5">Narration / Remarks</th>
                <th className="px-4 py-3.5 text-right w-32">Debit (+)</th>
                <th className="px-4 py-3.5 text-right w-32">Credit (-)</th>
                <th className="px-4 py-3.5 text-right w-32">Running Balance</th>
                <th className="px-4 py-3.5 w-24">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-850 font-bold text-slate-700 dark:text-slate-300 font-mono">
              {periodTransactions.length > 0 ? (
                periodTransactions.map((tx, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-3.5 font-bold">{new Date(tx.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3.5 text-blue-650 font-extrabold">{tx.voucherNo}</td>
                    <td className="px-4 py-3.5 font-semibold text-slate-700">{tx.voucherType}</td>
                    <td className="px-4 py-3.5 font-medium text-slate-500">{tx.module}</td>
                    <td className="px-4 py-3.5 text-slate-900 dark:text-white">{tx.accountTitle} ({tx.accountCode})</td>
                    <td className="px-4 py-3.5 text-slate-500 font-sans font-medium">{tx.remarks || "-"}</td>
                    <td className="px-4 py-3.5 text-right text-emerald-600">{tx.debit > 0 ? `PKR ${fmt(tx.debit)}` : "-"}</td>
                    <td className="px-4 py-3.5 text-right text-rose-600">{tx.credit > 0 ? `PKR ${fmt(tx.credit)}` : "-"}</td>
                    <td className="px-4 py-3.5 text-right text-slate-900 dark:text-white font-extrabold">PKR {fmt(tx.runningBalance)}</td>
                    <td className="px-4 py-3.5 text-slate-400 text-[10px] font-bold uppercase">{tx.source}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-400 uppercase tracking-widest font-sans text-[10px]">
                    No transactions found for the selected period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
