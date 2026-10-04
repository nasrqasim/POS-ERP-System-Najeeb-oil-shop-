"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { exportToExcel, printListDocument } from "@/lib/excel";

export default function DailyCashBookPage() {
  const [ledgerTxs, setLedgerTxs] = useState<any[]>([]);
  const [ledgerOpening, setLedgerOpening] = useState(0);
  const [loading, setLoading] = useState(true);

  const [dateRange, setDateRange] = useState("today");
  const [customFromDate, setCustomFromDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [customToDate, setCustomToDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cash-bank-ledger");
      const json = await res.json();
      if (json.ok) {
        setLedgerTxs(json.data.transactions || []);
        setLedgerOpening(json.data.opening || 0);
      }
    } catch (e) {
      console.error("Error fetching cash book:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const { start, end } = useMemo(() => {
    const now = new Date();
    let s = new Date(now);
    let e = new Date(now);

    if (dateRange === "today") {
      s.setHours(0, 0, 0, 0);
      e.setHours(23, 59, 59, 999);
    } else if (dateRange === "yesterday") {
      s.setDate(s.getDate() - 1);
      s.setHours(0, 0, 0, 0);
      e.setDate(e.getDate() - 1);
      e.setHours(23, 59, 59, 999);
    } else if (dateRange === "thisMonth") {
      s = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      e = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (dateRange === "custom") {
      const f = customFromDate.split("-").map(Number);
      const t = customToDate.split("-").map(Number);
      s = new Date(f[0], f[1] - 1, f[2], 0, 0, 0, 0);
      e = new Date(t[0], t[1] - 1, t[2], 23, 59, 59, 999);
    }
    return { start: s, end: e };
  }, [dateRange, customFromDate, customToDate]);

  const { periodTransactions, periodOpening, periodClosing } = useMemo(() => {
    let beforeDebit = 0;
    let beforeCredit = 0;
    const periodTxs: any[] = [];

    ledgerTxs.forEach(tx => {
      const d = new Date(tx.date).getTime();
      if (d < start.getTime()) {
        beforeDebit += (tx.debit || 0);
        beforeCredit += (tx.credit || 0);
      } else if (d >= start.getTime() && d <= end.getTime()) {
        periodTxs.push(tx);
      }
    });

    const periodOpen = ledgerOpening + beforeDebit - beforeCredit;
    
    let running = periodOpen;
    periodTxs.forEach(t => {
      running += (t.debit || 0) - (t.credit || 0);
      t.periodRunning = running;
    });

    return { 
      periodTransactions: periodTxs, 
      periodOpening: periodOpen,
      periodClosing: running
    };
  }, [ledgerTxs, ledgerOpening, start, end]);

  const fmt = (n: number) => Math.abs(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Daily Cash Book</h1>
          <p className="text-sm text-slate-500 font-medium">Consolidated view of Cash & Bank movements</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-6 shadow-sm flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Period</label>
          <select 
            value={dateRange}
            onChange={e => setDateRange(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="thisMonth">This Month</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>
        {dateRange === "custom" && (
          <>
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">From</label>
              <input 
                type="date"
                value={customFromDate}
                onChange={e => setCustomFromDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none"
              />
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">To</label>
              <input 
                type="date"
                value={customToDate}
                onChange={e => setCustomToDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none"
              />
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-850">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Period Opening Balance</h3>
          <p className={`text-3xl font-black ${periodOpening >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            PKR {fmt(periodOpening)}
          </p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-850">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Period Closing Balance</h3>
          <p className={`text-3xl font-black ${periodClosing >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            PKR {fmt(periodClosing)}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-400 text-sm font-bold animate-pulse">Computing Cash Book...</div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-black uppercase tracking-wider">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Voucher #</th>
                  <th className="px-4 py-3">Account</th>
                  <th className="px-4 py-3">Remarks</th>
                  <th className="px-4 py-3 text-right">Debit / In (+)</th>
                  <th className="px-4 py-3 text-right">Credit / Out (-)</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-850 font-bold text-slate-700 dark:text-slate-300">
                {periodTransactions.length > 0 ? (
                  periodTransactions.map((tx, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3">{new Date(tx.date).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-blue-600">{tx.voucherNo}</td>
                      <td className="px-4 py-3">{tx.accountTitle} <span className="text-[10px] text-slate-400">({tx.accountCode})</span></td>
                      <td className="px-4 py-3 text-slate-500 font-sans font-medium">{tx.remarks}</td>
                      <td className="px-4 py-3 text-right text-emerald-600">{tx.debit > 0 ? `PKR ${fmt(tx.debit)}` : "-"}</td>
                      <td className="px-4 py-3 text-right text-rose-600">{tx.credit > 0 ? `PKR ${fmt(tx.credit)}` : "-"}</td>
                      <td className="px-4 py-3 text-right text-slate-900 dark:text-white font-black">PKR {fmt(tx.periodRunning)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                      No transactions in this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
